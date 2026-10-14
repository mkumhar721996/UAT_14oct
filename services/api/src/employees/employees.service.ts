import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CORE_FIELDS, CoreField } from './employee-fields';
import { Employee } from './entities/employee.entity';
import { EmploymentHistoryEntry } from './entities/employment-history-entry.entity';
import { PendingChangeRequest } from './entities/pending-change-request.entity';

type Manager = Pick<DataSource, 'getRepository'>;

const toText = (v: string | number | null | undefined): string | null =>
  v === null || v === undefined || v === '' ? null : String(v);

function normalise(field: CoreField, v: string | number | null | undefined): string | number | null {
  if (v === null || v === undefined || v === '') return null;
  return field === 'salary' ? Number(v) : String(v);
}

@Injectable()
export class EmployeesService {
  constructor(private readonly dataSource: DataSource) {}

  private async nextEmployeeNumber(): Promise<string> {
    const [row] = await this.dataSource.query(`SELECT nextval('employee_number_seq') AS n`);
    return `EMP-${row.n}`;
  }

  /** Appends one history row and sets the new active value on the employee (not yet saved). */
  private applyCoreChange(
    m: Manager,
    tenantId: string,
    employee: Employee,
    field: CoreField,
    value: string | number | null,
    effectiveDate: string,
    recordedBy: string | null,
  ): Promise<EmploymentHistoryEntry> {
    const history = m.getRepository(EmploymentHistoryEntry);
    const entry = history.create({
      tenantId,
      employeeId: employee.id,
      field,
      previousValue: toText(employee[field]),
      newValue: toText(value),
      effectiveDate,
      recordedBy,
    });
    (employee as any)[field] = value;
    return history.save(entry);
  }

  async createEmployee(tenantId: string, dto: CreateEmployeeDto, recordedBy: string | null = null): Promise<Employee> {
    const employeeNumber = await this.nextEmployeeNumber();
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(Employee);
      const employee = await repo.save(
        repo.create({
          tenantId,
          employeeNumber,
          fullName: dto.fullName.trim(),
          startDate: dto.startDate,
          jobTitle: null,
          department: null,
          contractType: null,
          salary: null,
          personalEmail: null,
          phone: null,
        }),
      );
      for (const field of CORE_FIELDS) {
        const value = normalise(field, dto[field]);
        if (value !== null) await this.applyCoreChange(m, tenantId, employee, field, value, dto.startDate, recordedBy);
      }
      return repo.save(employee);
    });
  }

  async listEmployees(tenantId: string): Promise<Employee[]> {
    const rows = await this.dataSource.getRepository(Employee).find({ where: { tenantId } });
    return rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  /** With `lock`, takes a row lock held until the surrounding transaction ends. */
  private async loadEmployee(m: Manager, tenantId: string, id: string, lock = false): Promise<Employee> {
    const employee = await m
      .getRepository(Employee)
      .findOne({ where: { tenantId, id }, ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  getEmployee(tenantId: string, id: string): Promise<Employee> {
    return this.loadEmployee(this.dataSource, tenantId, id);
  }

  async updateAsHrAdmin(tenantId: string, id: string, dto: UpdateEmployeeDto, recordedBy: string | null = null): Promise<Employee> {
    return this.dataSource.transaction(async (m) => {
      // Locked so concurrent edits can't record stale previous values.
      const employee = await this.loadEmployee(m, tenantId, id, true);
      const changes: { field: CoreField; value: string | number | null; effectiveDate: string }[] = [];
      for (const field of CORE_FIELDS) {
        if (dto[field] === undefined) continue;
        const value = normalise(field, dto[field]);
        if (value === employee[field]) continue;
        const effectiveDate = dto[`${field}EffectiveDate`];
        if (!effectiveDate) throw new BadRequestException(`${field}EffectiveDate is required when ${field} changes`);
        changes.push({ field, value, effectiveDate });
      }
      if (dto.fullName !== undefined) employee.fullName = dto.fullName.trim();
      if (dto.startDate !== undefined) employee.startDate = dto.startDate;
      for (const c of changes) await this.applyCoreChange(m, tenantId, employee, c.field, c.value, c.effectiveDate, recordedBy);
      return m.getRepository(Employee).save(employee);
    });
  }

  async updateOwnContact(tenantId: string, employeeId: string, dto: UpdateContactDto): Promise<Employee> {
    const employee = await this.getEmployee(tenantId, employeeId);
    if (dto.personalEmail !== undefined) employee.personalEmail = toText(dto.personalEmail);
    if (dto.phone !== undefined) employee.phone = toText(dto.phone);
    return this.dataSource.getRepository(Employee).save(employee);
  }

  async getHistory(tenantId: string, employeeId: string): Promise<EmploymentHistoryEntry[]> {
    await this.getEmployee(tenantId, employeeId);
    const rows = await this.dataSource.getRepository(EmploymentHistoryEntry).find({ where: { tenantId, employeeId } });
    return rows.sort(
      (a, b) =>
        a.effectiveDate.localeCompare(b.effectiveDate) || new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );
  }

  async submitChangeRequest(tenantId: string, employeeId: string, dto: CreateChangeRequestDto): Promise<PendingChangeRequest> {
    await this.getEmployee(tenantId, employeeId);
    if (dto.field === 'salary' && !(Number(dto.requestedValue) >= 0)) {
      throw new BadRequestException('requestedValue must be a non-negative number for salary');
    }
    const repo = this.dataSource.getRepository(PendingChangeRequest);
    const open = await repo.find({ where: { tenantId, employeeId, field: dto.field, status: 'pending' } });
    if (open.length > 0) throw new ConflictException(`A ${dto.field} change is already awaiting approval`);
    return repo.save(
      repo.create({
        tenantId,
        employeeId,
        field: dto.field,
        requestedValue: dto.requestedValue.trim(),
        effectiveDate: dto.effectiveDate,
        note: dto.note?.trim() || null,
        status: 'pending',
        resolvedAt: null,
        resolvedBy: null,
      }),
    );
  }

  async listPendingRequests(tenantId: string, employeeId?: string): Promise<PendingChangeRequest[]> {
    const status = 'pending' as const;
    const where = employeeId ? { tenantId, employeeId, status } : { tenantId, status };
    const rows = await this.dataSource.getRepository(PendingChangeRequest).find({ where });
    return rows.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  }

  private async getOpenRequest(m: Manager, tenantId: string, requestId: string): Promise<PendingChangeRequest> {
    const req = await m.getRepository(PendingChangeRequest).findOne({ where: { tenantId, id: requestId }, lock: { mode: 'pessimistic_write' } });
    if (!req) throw new NotFoundException('Change request not found');
    if (req.status !== 'pending') throw new ConflictException('Change request was already resolved');
    return req;
  }

  async approveChangeRequest(tenantId: string, requestId: string, approverSub: string): Promise<Employee> {
    return this.dataSource.transaction(async (m) => {
      const req = await this.getOpenRequest(m, tenantId, requestId);
      const employee = await this.loadEmployee(m, tenantId, req.employeeId, true);
      const field = req.field as CoreField;
      await this.applyCoreChange(m, tenantId, employee, field, normalise(field, req.requestedValue), req.effectiveDate, approverSub);
      req.status = 'approved';
      req.resolvedAt = new Date();
      req.resolvedBy = approverSub;
      await m.getRepository(PendingChangeRequest).save(req);
      return m.getRepository(Employee).save(employee);
    });
  }

  async rejectChangeRequest(tenantId: string, requestId: string, approverSub: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const req = await this.getOpenRequest(m, tenantId, requestId);
      req.status = 'rejected';
      req.resolvedAt = new Date();
      req.resolvedBy = approverSub;
      await m.getRepository(PendingChangeRequest).save(req);
    });
  }
}
