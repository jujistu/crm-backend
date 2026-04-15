import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { BirthdayReminderService } from './birthday-reminder.service';

@Module({
  imports: [MailModule],
  providers: [BirthdayReminderService],
})
export class SchedulerModule {}
