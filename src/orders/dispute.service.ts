import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Dispute, DisputeStatus } from "./entities/dispute.entity";
import { Repository } from "typeorm";
import { DisputeMessage } from "./entities/dispute-messages";
import { Order } from "./entities/order.entity";
import { WalletService } from "src/wallet/wallet.service";
import { MailserviceService } from "src/mailservice/mailservice.service";
import { AddDisputeMessageDto, InitiateDisputeDto, ResolveDisputeDto } from "./dto/dispute.dto";
import { OrderStatus } from "./orders.enum";
import { User } from "src/users/entities/user.entity";
import { UserRole } from "src/users/user-role.enum";

@Injectable()
export class DisputeService {
  constructor(
    @InjectRepository(Dispute) private disputeRepo: Repository<Dispute>,
    @InjectRepository(DisputeMessage) private messageRepo: Repository<DisputeMessage>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    private walletService: WalletService,
    private mailService: MailserviceService,
  ) { }

  // 1. INITIATE (Buyer)
  async initiate(orderId: string, userId: string, dto: InitiateDisputeDto) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, buyer: { id: userId } },
      relations: ['items', 'items.seller']
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentStatus !== 'escrow_held') throw new BadRequestException('Only orders in escrow can be disputed');

    const existingDispute = await this.disputeRepo.findOne({
      where: { order: { id: orderId } }
    });
    if (existingDispute) {
      throw new BadRequestException('A dispute already exists for this order');
    }

    order.status = 'disputed' as any;
    await this.orderRepo.save(order);

    // Use Instance creation to satisfy TypeScript Overloads
    const dispute = new Dispute();
    dispute.order = order;
    dispute.buyer = { id: userId } as User;
    dispute.reason = dto.reason;
    dispute.status = DisputeStatus.OPEN;

    const savedDispute = await this.disputeRepo.save(dispute);
    const fullDispute = await this.findOne(savedDispute.id, UserRole.BUYER, userId);

    // Create the first message
    await this.addMessage(savedDispute.id, userId, {
      message: dto.message,
      // priority: dto.priority,
      attachments: dto.attachments
    });

    return fullDispute;
  }

  // 2. ADD MESSAGE
  async addMessage(disputeId: string, userId: string, dto: AddDisputeMessageDto) {
   const dispute = await this.disputeRepo.findOne({
        where: { id: disputeId },
        relations: ['buyer', 'order', 'order.items', 'order.items.seller', 'order.items.seller.user']
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    /* if (!isBuyer && !isSeller) {
        throw new ForbiddenException('You are not part of this dispute');
    } */

    if ([DisputeStatus.CLOSED, DisputeStatus.RESOLVED_REFUNDED, DisputeStatus.RESOLVED_RELEASED].includes(dispute.status)) {
        throw new BadRequestException('This dispute is already closed');
    }

    const message = this.messageRepo.create({
      dispute: { id: disputeId },
      sender: { id: userId } as any,
      message: dto.message,
      attachments: dto.attachments
    });

    const savedMessage = await this.messageRepo.save(message);
    const fullMessage = await this.messageRepo.findOne({
      where: { id: savedMessage.id },
      relations: ['sender']
    });

    dispute.status = DisputeStatus.AWAITING_RESPONSE;
    await this.disputeRepo.save(dispute);

    return {
      ...fullMessage,
      sender: this.sanitizeUser(fullMessage.sender)
    };
  }

  // 3. ESCALATE
  async escalate(disputeId: string, userId: string) {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId }, relations: ['buyer']  });
    if (!dispute) throw new NotFoundException('Dispute not found');

    if (dispute.buyer?.id !== userId) {
        throw new ForbiddenException('Only the buyer can escalate this dispute');
    }

    if (dispute.status === DisputeStatus.ESCALATED) {
        throw new BadRequestException('Dispute is already escalated');
    }


    dispute.status = DisputeStatus.ESCALATED;
    return this.disputeRepo.save(dispute);
  }

  // 4. ADMIN RESOLVE
  async resolve(disputeId: string, dto: ResolveDisputeDto) {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      relations: ['order', 'order.items', 'order.items.seller']
    });

    if (!dispute) throw new NotFoundException('Dispute not found');

    if (dto.action === 'release') {
      for (const item of dispute.order.items) {
        const itemTotal = Number(item.priceAtPurchase) * item.quantity;
        const rate = item.commissionRate != null
          ? Number(item.commissionRate)
          : 0.05; // safe fallback
        const sellerNet = itemTotal * (1 - rate);
        await this.walletService.releaseEscrow(item.seller.id, sellerNet, dispute.order.id);
      }
      dispute.status = DisputeStatus.RESOLVED_RELEASED;
      dispute.order.status = OrderStatus.DELIVERED;
    } else {
      dispute.status = DisputeStatus.RESOLVED_REFUNDED;
      dispute.order.status = 'refunded' as any;
      dispute.order.paymentStatus = 'refunded';
    }

    dispute.adminResolutionNote = dto.note;
    await this.orderRepo.save(dispute.order);
    return this.disputeRepo.save(dispute);
  }

  // 5. FETCHING
  async findMyDisputes(userId: string, role: string) {
    const disputes = await this.disputeRepo.find({
      where: role === UserRole.ADMIN
        ? {}
        : role === UserRole.SELLER
          ? { order: { items: { seller: { user: { id: userId } } } } }
          : { buyer: { id: userId } },
      relations: [
        'order',
        'order.items',
        'order.items.seller',
        'buyer',
        'messages',
        'messages.sender',
      ],
      order: { createdAt: 'DESC' }
    });

    return disputes.map(dispute => this.sanitizeDispute(dispute));
  }

  async findOne(id: string, role: string, userId: string) {
    const dispute = await this.disputeRepo.findOne({
      where: { id },
      relations: [
        'buyer',
        'messages',
        'messages.sender',
        'order',
        'order.items',
        'order.items.product',
        'order.items.seller',
        'order.items.seller.user',
      ]
    });
    if (!dispute) throw new NotFoundException('Dispute not found');

    const isBuyer = dispute.buyer?.id === userId;
    const isSeller = dispute.order?.items?.some(
      item => item.seller?.user?.id === userId
    );

    if (role !== UserRole.ADMIN && !isBuyer && !isSeller) {
      throw new ForbiddenException('Access denied');
    }
    return this.sanitizeDispute(dispute);
  }

  /* ================= HELPERS ================= */

  private sanitizeDispute(dispute: Dispute) {
    if (!dispute) return null;

    return {
      ...dispute,
      buyer: this.sanitizeUser(dispute.buyer),
      order: {
        ...dispute.order,
        items: dispute.order?.items?.map(item => ({
          ...item,
          seller: this.sanitizeSeller(item.seller)
        }))
      },
      messages: dispute.messages?.map(msg => ({
        ...msg,
        sender: this.sanitizeUser(msg.sender)
      }))
    };
  }

  private sanitizeUser(user: any) {
    if (!user) return null;
    const {
      password, hashedRefreshToken, twoFactorSecret,
      passwordResetToken, passwordResetExpires,
      verificationToken, verificationExpires,
      deletedAt, deletedBy, restoredBy, deleteReason, rejectionReason,
      lifetimeSalesVolume, isTwoFactorEnabled, isOnboarded, 
      ...safeUser
    } = user;
    return safeUser;
  }

  private sanitizeSeller(seller: any) {
    if (!seller) return null;
    const {
      user, products,
      ...safeSeller
    } = seller;
    if (user) {
      safeSeller.user = this.sanitizeUser(user);
    }
    return safeSeller;
  }
}