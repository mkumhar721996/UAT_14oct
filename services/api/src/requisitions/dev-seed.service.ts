import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';

const DEV_USERS: Array<[string, string, string]> = [
  ['priya', 'Priya Nathan', 'hiring_manager'],
  ['jordan', 'Jordan Reyes', 'hiring_manager'],
  ['alicia', 'Alicia Gomez', 'hiring_manager'],
  ['wen', 'Wen Zhao', 'hiring_manager'],
  ['sam', 'Sam Osei', 'finance_analyst'],
  ['morgan', 'Morgan Clarke', 'hr_admin'],
  ['devon', 'Devon Blake', 'recruiter'],
];

/**
 * Until an employee directory feeds the `users` table, populate it with the development
 * identities the header-based actor stand-in refers to. Never runs in production.
 */
@Injectable()
export class DevSeedService implements OnApplicationBootstrap {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    for (const [id, name, role] of DEV_USERS) {
      if (!(await this.users.findOneBy({ id }))) {
        await this.users.save(
          this.users.create({ id, name, role, employmentStatus: 'active' }),
        );
      }
    }
  }
}
