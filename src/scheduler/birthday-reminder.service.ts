import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityAction } from '@prisma/client';
import cron, { ScheduledTask } from 'node-cron';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BirthdayReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BirthdayReminderService.name);
  private task?: ScheduledTask;

  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    if (
      this.configService.get<string>('BIRTHDAY_CRON_ENABLED', 'true') !== 'true'
    ) {
      this.logger.log('Birthday reminder scheduler disabled');
      return;
    }

    const expression = this.configService.get<string>(
      'BIRTHDAY_CRON_EXPRESSION',
      '0 8 * * *',
    );

    this.task = cron.schedule(expression, () => {
      void this.sendBirthdayReminders();
    });
  }

  onModuleDestroy() {
    void this.task?.stop();
  }

  async sendBirthdayReminders(referenceDate = new Date()) {
    const internalEmail = this.configService.getOrThrow<string>(
      'INTERNAL_REMINDER_EMAIL',
    );

    const contacts = await this.prisma.contactPerson.findMany({
      where: {
        deletedAt: null,
        birthday: { not: null },
        client: { deletedAt: null },
      },
      include: {
        client: {
          include: {
            accountManager: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    for (const contact of contacts) {
      const daysUntil = this.daysUntilBirthday(
        contact.birthday as Date,
        referenceDate,
      );

      if (daysUntil === 2 || daysUntil === 1) {
        await this.mailService.sendMail({
          to: internalEmail,
          subject: `${contact.name}'s birthday is in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          text: `${contact.name} from ${contact.client.name} has a birthday coming up on ${this.formatBirthday(contact.birthday as Date)}.`,
          html: `<p>${contact.name} from <strong>${contact.client.name}</strong> has a birthday coming up on ${this.formatBirthday(contact.birthday as Date)}.</p>`,
        });
      }

      if (daysUntil === 0) {
        await this.mailService.sendMail({
          to: contact.email,
          subject: `Happy birthday, ${contact.name}!`,
          text: `Happy birthday ${contact.name}! Wishing you a wonderful day from our team.`,
          html: `<p>Happy birthday ${contact.name}!</p><p>Wishing you a wonderful day from our team.</p>`,
        });
      }

      if ([0, 1, 2].includes(daysUntil)) {
        await this.prisma.activityLog.create({
          data: {
            action: ActivityAction.BIRTHDAY_REMINDER,
            entity: 'ContactPerson',
            entityId: contact.id,
            clientId: contact.clientId,
            metadata: { daysUntil },
          },
        });
      }
    }
  }

  private daysUntilBirthday(birthday: Date, referenceDate: Date) {
    const today = this.atStartOfDay(referenceDate);
    let nextBirthday = new Date(
      today.getFullYear(),
      birthday.getMonth(),
      birthday.getDate(),
    );

    if (nextBirthday < today) {
      nextBirthday = new Date(
        today.getFullYear() + 1,
        birthday.getMonth(),
        birthday.getDate(),
      );
    }

    return Math.round(
      (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  private atStartOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private formatBirthday(birthday: Date) {
    return birthday.toLocaleDateString('en', {
      month: 'long',
      day: 'numeric',
    });
  }
}
