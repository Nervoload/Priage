import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { ClinicAppointmentsService } from '../../clinic/clinic-appointments.service';

@Processor('appointments')
export class AppointmentsProcessor extends WorkerHost {
  constructor(private readonly appointments: ClinicAppointmentsService) { super(); }

  async process(job: Job): Promise<void> {
    if (job.name !== 'expire-clinic-requests') throw new Error(`Unknown appointment job: ${job.name}`);
    await this.appointments.sweepExpiredRequests();
  }
}
