// src/orders/orders.service.ts
import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, PaymentMethod } from './entities/order.entity';
import { FulfillmentStatus, OrderItem } from './entities/order-item.entity';
import { Product } from 'src/products/entities/product.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './orders.enum';
import { User } from 'src/users/entities/user.entity';
import { SystemSettingsService } from 'src/system-settings/system-settings.service';
import { WalletService } from 'src/wallet/wallet.service';
import { SellerService } from 'src/seller/seller.service';
import { MailserviceService } from 'src/mailservice/mailservice.service';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { PaymentGatewayFactory } from 'src/payment-gateways/factories/payment-gateway.factory';


@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,

    @InjectRepository(OrderItem) private orderItemRepo: Repository<OrderItem>,
    @InjectRepository(User) private userRepo: Repository<User>,

    @InjectRepository(Dispute) private disputeRepo: Repository<Dispute>,

    private gatewayFactory: PaymentGatewayFactory,
    private readonly mailService: MailserviceService,
    private settingsService: SystemSettingsService,
    private readonly sellerService: SellerService,

    private dataSource: DataSource,
    private walletService: WalletService,
  ) { }



  // orders.service.ts

  async createOrder(userID: string, email: string, dto: CreateOrderDto) {

    const paymentMethod = dto.paymentMethod ?? PaymentMethod.PAYSTACK;

    const gateway = this.gatewayFactory.getGateway(paymentMethod);

    if (!email) {
      throw new BadRequestException("INVALID USER")
    }



    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedOrder;


    try {
      let subtotal = 0;
      let totalPlatformFee = 0;
      const orderItems: OrderItem[] = [];

      for (const item of dto.items) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: item.productId },
          relations: ['seller', 'category', 'category.parent'],
          lock: { mode: 'pessimistic_write' },
        });

        if (!product || product.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${product?.title}`
          );
        }

        // ✅ Resolve commission: category → parent category → global
        const commissionRate = await this.settingsService.getEffectiveCommission(
          product.category ?? null
        );

        const itemPrice = Number(product.price);
        const itemTotal = itemPrice * item.quantity;
        const itemCommission = itemTotal * commissionRate;

        subtotal += itemTotal;
        totalPlatformFee += itemCommission;

        const orderItem = new OrderItem();
        orderItem.product = product;
        orderItem.quantity = item.quantity;
        orderItem.priceAtPurchase = itemPrice;
        orderItem.commissionRate = commissionRate; // ✅ Snapshot at order time
        orderItem.seller = product.seller;
        orderItem.productSnapshotTitle = product.title;
        orderItem.productSnapshotImage = product.primaryImage;
        orderItem.typeSnapshot = product.type;
        orderItem.productSnapshotCategory = product.category?.name ?? null;

        orderItems.push(orderItem);

        product.stock -= item.quantity;
        await queryRunner.manager.save(
          product
        );
      }

      // ✅ Gateway fee is now the gateway's own responsibility

      const gatewayFee = await gateway.calculateTransactionFee(subtotal);


      // TO MAKE BUYER PAY THE PLATFORM FES IN THE FUTURE IMPLEMET THIS 
      //totalAmount = subtotal + gatewayFee

      const order = this.orderRepo.create({
        buyer: { id: userID } as User,
        subtotal,
        platformFee: totalPlatformFee,   // mixed category rates, correctly summed
        paymentGatewayFee: gatewayFee,   // from active gateway
        totalAmount: subtotal,           // buyer pays subtotal; fees are internal
        shippingAddress: dto.shippingAddress,
        status: OrderStatus.PENDING,
        paymentStatus: 'unpaid',
        paymentMethod: dto.paymentMethod as PaymentMethod,
      });



      savedOrder = await queryRunner.manager.save(order);

      for (const item of orderItems) {
        item.order = savedOrder;
      }





      await queryRunner.manager.save(OrderItem, orderItems);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Outside transaction — Paystack/Flutterwave call
    try {

      const paymentData = await gateway.initializeTransaction(
        email,
        savedOrder.totalAmount,
        { orderId: savedOrder.id }
      );

      await this.orderRepo.update(savedOrder.id, {
        paymentReference: paymentData.reference,
      });

      const check = await this.orderRepo.findOne({ where: { id: savedOrder.id } });
      console.log('Reference saved:', check?.paymentReference);

      console.log('Payment data from gateway:', paymentData);
      console.log('Reference:', paymentData?.reference);
      console.log('Auth URL:', paymentData?.authorization_url);

      return {
        order: savedOrder,
        authorization_url: paymentData.authorization_url,
      };
    } catch (error) {
      throw new BadRequestException(
        'Order created, but payment gateway is unreachable.'
      );
    }
  }


  async retryPayment(orderId: string, userId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, buyer: { id: userId } },
      relations: ['buyer']
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // ❌ Prevent retry if already paid
    if (order.paymentStatus !== 'unpaid') {
      throw new BadRequestException('This order cannot be paid again');
    }

    // ❌ Prevent retry if cancelled
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cancelled orders cannot be retried');
    }

    try {

      const gateway = this.gatewayFactory.getGateway(order.paymentMethod); // or store method on order

      const paymentData = await gateway.initializeTransaction(
        order.buyer?.email || '',
        order.totalAmount,
        {
          orderId: order.id,
          type: 'order_payment',
        }
      );

      // ✅ Update payment reference
      await this.orderRepo.update(order.id, {
        paymentReference: paymentData.reference,
      });

      return {
        checkoutUrl: paymentData.authorization_url,
        reference: paymentData.reference,
        amount: order.totalAmount,
        email: order.buyer?.email,
      };
    } catch (error) {
      throw new BadRequestException('Payment gateway unavailable');
    }
  }



  // Helper to update reference after Paystack initialization
  async updatePaymentReference(orderId: string, reference: string) {
    await this.orderRepo.update(orderId, { paymentReference: reference });
  }

  /* --- For Buyers: View My Purchases --- */
  async findAllByUser(userId: string) {
    return this.orderRepo.find({
      where: { buyer: { id: userId } },
      relations: ['items', 'items.product', 'items.seller'],
      withDeleted: true,
      order: { createdAt: 'DESC' },
    });
  }

  /* --- For Sellers: View Orders of My Products --- */
  async findSalesBySeller(userId: string) {
    const seller = await this.sellerService.getMyStore(userId);
    return this.dataSource.getRepository(OrderItem).find({
      where: { seller: { id: seller.id } },
      relations: ['order', 'product', 'order.buyer'],
      withDeleted: true,
      select: {
        order: {
          id: true,
          shippingAddress: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          buyer: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            userAvatar: true
          }
        }
      },
      order: { order: { createdAt: 'DESC' } },
    });
  }

  async markItemAsShipped(orderItemId: string, userId: string) {
    const seller = await this.sellerService.getMyStore(userId);


    const item = await this.orderItemRepo.findOne({
      where: {
        id: orderItemId,
        seller: { id: seller.id }
      },
      relations: ['order', 'order.buyer', 'product']
    });



    if (!item) throw new NotFoundException('Sale record not found');

    if (item.fulfillmentStatus !== FulfillmentStatus.PENDING) {
      throw new BadRequestException(`Item is already ${item.fulfillmentStatus}`);
    }



    item.fulfillmentStatus = FulfillmentStatus.SHIPPED;
    // Trigger an email notification to the buyer here

    if (item.order?.buyer && item.product) {
      await this.mailService.sendShippingNotification(item.order, item.product.title);
    }

    return await this.orderItemRepo.save(item);
  }


  // 2. The "Confirm Delivery" logic (The Escrow Trigger)
  async confirmDelivery(orderId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const userRepo = manager.getRepository(User);

      const order = await orderRepo.findOne({
        where: { id: orderId, buyer: { id: userId } },
        relations: ['items', 'items.seller', 'items.seller.user', 'buyer'],
      });

      if (!order) throw new NotFoundException('Order not found');

      if (order.paymentStatus !== 'escrow_held') {
        throw new BadRequestException('Payment is not in Escrow. Cannot release funds.');
      }

      if (order.items.some(i => i.fulfillmentStatus !== FulfillmentStatus.SHIPPED)) {
        throw new BadRequestException('Not all items have been shipped yet');
      }

      if (order.status === OrderStatus.DELIVERED) {
        throw new BadRequestException('Order already completed');
      }

      // Move money from Pending -> Available
      for (const item of order.items) {
        const itemTotal = Number(item.priceAtPurchase) * item.quantity;
        const rate = item.commissionRate != null
          ? Number(item.commissionRate)
          : await this.settingsService.getNumber('COMMISSION_PERCENT', 0.05);

        const sellerNet = itemTotal * (1 - rate);

        if (item.seller?.user?.id) {
          await userRepo.update(item.seller.user.id, {
            lifetimeSalesVolume: () => `lifetimeSalesVolume + ${itemTotal}`
          });
        }

        if (item.seller?.id) {
          await this.walletService.releaseEscrow(item.seller.id, sellerNet, order.id, manager);
        }
      }

      order.status = OrderStatus.DELIVERED;
      order.paymentStatus = 'released';

      const savedOrder = await orderRepo.save(order);

      // Trigger Email Notification
      try {
        await this.mailService.sendDeliveryNotification(order, order.items[0]?.productSnapshotTitle || 'purchased items');
      } catch (mailErr) {
        // Log mail error, do not fail transaction
        console.error('Failed to send delivery email:', mailErr);
      }

      return savedOrder;
    });
  }

  //  - single source of truth for wallet logic
  async markAsPaid(orderId: string) {
    let alreadyPaid = false;

    // Step 1: Lock, check, update — release lock fast
    const order = await this.dataSource.transaction(async (manager) => {
        const order = await manager.findOne(Order, {
            where: { id: orderId },
            relations: ['items', 'items.seller', 'buyer'],
            lock: { mode: 'pessimistic_write' },
        });

        if (!order) throw new NotFoundException('Order not found');

        if (order.paymentStatus !== 'unpaid') {
            alreadyPaid = true; // ✅ signal to skip wallet ops
            return order;
        }

        order.paymentStatus = 'escrow_held';
        order.status = OrderStatus.PAID;
        await manager.save(order);
        return order;
    }); // ✅ Lock released here

    // Step 2: Only credit wallets if THIS call was the one that changed the status
    if (!alreadyPaid) {
        for (const item of order.items) {
            const itemTotal = Number(item.priceAtPurchase) * item.quantity;
            const rate = item.commissionRate != null
                ? Number(item.commissionRate)
                : await this.settingsService.getNumber('COMMISSION_PERCENT', 0.05);

            const sellerNet = itemTotal * (1 - rate);
            await this.walletService.addPendingFunds(item.seller.id, sellerNet, order.id);
        }
    }
     /* await this.mailService.sendPaymentSuccessEmail(order.buyer.email, order); */

    return order;
}

  async findOneByReference(paymentReference: string) {
    return this.orderRepo.findOne({
      where: { paymentReference },
      relations: ['items', 'items.seller']
    });
  }
  async findOneById(orderId: string) {
    return this.orderRepo.findOne({
        where: { id: orderId },
        relations: ['items', 'items.seller'],
    });
}



  // Disputes & resolution: Admin can manually refund or release funds if needed (Not implemented yet)
  async raiseDispute(userId: string, orderId: string, dto: any) {
    const order = await this.orderRepo.findOne({ where: { id: orderId, buyer: { id: userId } } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentStatus !== 'escrow_held') throw new BadRequestException('Order is not in escrow');

    const dispute = this.disputeRepo.create({
      ...dto,
      order: order,
      raisedBy: { id: userId },
    });

    order.status = 'disputed' as any; // Update order status
    await this.orderRepo.save(order);

    // Notify Seller and Admin via Email
    // await this.mailService.sendDisputeOpenedEmail(order.seller.email, order.id);

    return await this.disputeRepo.save(dispute);
  }

  async adminResolveDispute(disputeId: string, resolution: 'refund' | 'release', adminNote: string) {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      relations: ['order', 'order.items', 'order.items.seller', 'order.buyer']
    });
    if (!dispute) throw new NotFoundException('Dispute not found');


    if (resolution === 'release') {
      // ADMIN SIDES WITH SELLER: Release Escrow as normal
      for (const item of dispute.order.items) {
        const itemTotal = Number(item.priceAtPurchase) * item.quantity;
        const sellerNet = itemTotal * (1 - Number(item.commissionRate)); // ✅ snapshotted rate
        await this.walletService.releaseEscrow(item.seller.id, sellerNet, dispute.order.id);
      }
      dispute.status = DisputeStatus.RESOLVED_RELEASED;
      dispute.order.status = OrderStatus.DELIVERED;
    } else {
      // ADMIN SIDES WITH BUYER: Refund logic
      // In a real system, this would trigger a Paystack Refund or add to a Buyer's "Store Credit"
      dispute.status = DisputeStatus.RESOLVED_REFUNDED;
      dispute.order.status = 'refunded' as any;
    }

    dispute.adminResolutionNote = adminNote;
    await this.orderRepo.save(dispute.order);
    return await this.disputeRepo.save(dispute);
  }

  /* --- For Admin: View All Sales Across All Sellers --- */
  async findAllSales() {
    return this.dataSource.getRepository(OrderItem).find({
      relations: ['order', 'product', 'order.buyer', 'seller'],
      withDeleted: true,
      select: {
        order: {
          id: true,
          shippingAddress: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          buyer: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            userAvatar: true,
          },
        },
        seller: {
          id: true,
          businessName: true,
          storeSlug: true,
        },
      },
      order: { order: { createdAt: 'DESC' } },
    });
  }

}