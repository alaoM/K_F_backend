import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { url } from 'inspector';

@Injectable()
export class MailserviceService {
    constructor(private mailService: MailerService) { }

    async sendGenericNotification(
        email: string,
        name: string,
        title: string,
        message: string,
        link?: string
    ) {
        await this.mailService.sendMail({
            to: email,
            subject: title,
            template: 'notification', // Corresponds to notification.hbs
            context: {
                name,
                title,
                message,
                link,
                year: new Date().getFullYear(),
            },
        });
    }

    async sendUserWelcome(
        user: { email: string; fullName?: string },
        verificationUrl: string,
    ) {
        await this.mailService.sendMail({
            to: user.email,
            subject: 'Welcome to AgroCommerce – Verify Your Email',
            template: 'welcome',
            context: {
                name: user.fullName || '',
                verificationUrl,
                year: new Date().getFullYear(),
            },
        });
    }


    async sendPasswordReset(user: any, url: string) {
        
        await this.mailService.sendMail({
            to: user.email,
            subject: 'Password Reset Request',
            template: 'reset-password', // Corresponds to reset-password.hbs
            context: {
                name: user.fullName,
                url: url,
            },
        });
    }
    async send2FACode(user: any, code: string) {
        await this.mailService.sendMail({
            to: user.email,
            subject: 'Your 2FA Code',
            template: 'otp', // Corresponds to otp.hbs
            context: {
                name: user.fullName,
                otp: code,
            },
        });
    }

    async sendShippingNotification(order: any, title: string) {
        await this.mailService.sendMail({
            to: order.buyer?.email,
            subject: `Your order - ${title} has been shipped`,
            template: 'order-shipped',  
            context: {
                name: order.buyer?.fullName || 'Customer',
                title: title,
            },
        });
    }

    async sendDeliveryNotification(order: any, title: string) {
        await this.mailService.sendMail({
            to: order.buyer?.email,
            subject: `Your order - ${title} has been delivered`,
            template: 'order-delivered', // Corresponds to order-delivered.hbs
            context: {
                name: order.buyer?.fullName || 'Customer',
                title: title,
            },
        });
    }

    /**
     * Sends an approval email to the Seller/Creator
     */
    async sendSellerApprovalEmail(email: string, name: string) {
        await this.mailService.sendMail({
            to: email,
            subject: 'Congratulations! Your Account is Approved',
            template: 'seller-approval', // Points to seller-approval.hbs
            context: {
                name: name,
                loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
            },
        }); 
      
    }

    /**
     * Sends a rejection email with the specific reason
     */
    async sendRejectionEmail(email: string, name: string, reason: string) {
        await this.mailService.sendMail({
            to: email,
            subject: 'Important: Update required for your Application',
            template: 'seller-rejection', // Points to seller-rejection.hbs
            context: {
                name: name,
                reason: reason, // The reason passed from the Admin UI
                onboardingUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding/become-a-seller`,
            },
        }); 
       
    }
}
