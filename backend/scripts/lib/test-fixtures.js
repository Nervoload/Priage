const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

const DEFAULT_HOSPITAL_CONFIG = {
  triageReassessmentMinutes: 30,
  features: {
    messaging: true,
    alerts: true,
  },
};

class TestFixtureTracker {
  constructor(prisma, label = 'fixture') {
    this.prisma = prisma;
    this.label = label;
    this.hospitalIds = [];
    this.userIds = [];
    this.patientIds = [];
  }

  trackHospital(id) {
    pushUnique(this.hospitalIds, id);
    return id;
  }

  trackUser(id) {
    pushUnique(this.userIds, id);
    return id;
  }

  trackPatient(id) {
    pushUnique(this.patientIds, id);
    return id;
  }

  async createHospital(options = {}) {
    const suffix = randomUUID().slice(0, 8);
    const namePrefix = options.namePrefix || 'Test Hospital';
    const slugPrefix = options.slugPrefix || 'test-hospital';
    const hospital = await this.prisma.hospital.create({
      data: {
        name: `${namePrefix} ${suffix}`,
        slug: `${slugPrefix}-${suffix}`,
        ...(options.withConfig === false
          ? {}
          : {
              config: {
                create: {
                  config: DEFAULT_HOSPITAL_CONFIG,
                },
              },
            }),
      },
      include: {
        config: true,
      },
    });
    this.trackHospital(hospital.id);
    return hospital;
  }

  async createUser(options) {
    const suffix = randomUUID().slice(0, 8);
    const email = options.email || `${options.emailPrefix || 'user'}-${suffix}@priage.test`;
    const passwordHash = await bcrypt.hash(options.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role: options.role,
        hospitalId: options.hospitalId,
      },
    });
    this.trackUser(user.id);
    return user;
  }

  async createUserBundle(options) {
    const roles = options.roles || ['ADMIN', 'NURSE', 'DOCTOR', 'STAFF'];
    const users = {};
    for (const role of roles) {
      const emailPrefix = `${this.label.toLowerCase()}-${role.toLowerCase()}`;
      users[role] = await this.createUser({
        hospitalId: options.hospitalId,
        password: options.password,
        role,
        emailPrefix,
      });
    }
    return users;
  }

  async createPatient(options = {}) {
    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash(options.password || `Priage-${randomUUID()}`, 10);
    const patient = await this.prisma.patientProfile.create({
      data: {
        email: options.email || `${options.emailPrefix || 'patient'}-${suffix}@patient.local`,
        password: passwordHash,
        firstName: options.firstName || 'Test',
        lastName: options.lastName || 'Patient',
        phone: options.phone || null,
        age: options.age ?? 35,
        gender: options.gender || 'Other',
        preferredLanguage: options.preferredLanguage || 'en',
      },
    });
    this.trackPatient(patient.id);
    return patient;
  }

  async createAssociatedPatient(options) {
    const patient = await this.createPatient({
      password: options.password,
      firstName: options.firstName || 'Associated',
      lastName: options.lastName || 'Patient',
      emailPrefix: options.emailPrefix || 'associated-patient',
      preferredLanguage: options.preferredLanguage || 'en',
    });

    const now = new Date();
    await this.prisma.encounter.create({
      data: {
        publicId: `enc_${randomUUID()}`,
        hospitalId: options.hospitalId,
        patientId: patient.id,
        status: options.terminalStatus || 'COMPLETE',
        chiefComplaint: options.chiefComplaint || 'Historical encounter for hospital association',
        details: options.details || 'Fixture-only terminal encounter used to associate the patient.',
        expectedAt: new Date(now.getTime() - 60 * 60_000),
        arrivedAt: new Date(now.getTime() - 55 * 60_000),
        triagedAt: new Date(now.getTime() - 45 * 60_000),
        waitingAt: new Date(now.getTime() - 35 * 60_000),
        seenAt: new Date(now.getTime() - 20 * 60_000),
        departedAt: new Date(now.getTime() - 5 * 60_000),
      },
    });

    return patient;
  }

  async createEncounter(options) {
    return this.prisma.encounter.create({
      data: {
        publicId: options.publicId || `enc_${randomUUID()}`,
        hospitalId: options.hospitalId,
        patientId: options.patientId,
        status: options.status || 'EXPECTED',
        chiefComplaint: options.chiefComplaint || null,
        details: options.details || null,
        expectedAt: options.expectedAt || new Date(),
        arrivedAt: options.arrivedAt || null,
        triagedAt: options.triagedAt || null,
        waitingAt: options.waitingAt || null,
        seenAt: options.seenAt || null,
        departedAt: options.departedAt || null,
        cancelledAt: options.cancelledAt || null,
      },
    });
  }

  async createPatientSession(options) {
    return this.prisma.patientSession.create({
      data: {
        token: options.token || randomUUID(),
        patientId: options.patientId,
        encounterId: options.encounterId || null,
        expiresAt: options.expiresAt || new Date(Date.now() + 24 * 60 * 60_000),
      },
    });
  }

  async cleanup() {
    const hospitalIds = uniqueIntegers(this.hospitalIds);
    const userIds = uniqueIntegers(this.userIds);
    const patientIds = uniqueIntegers(this.patientIds);

    if (hospitalIds.length === 0 && userIds.length === 0 && patientIds.length === 0) {
      return;
    }

    const encounters = await this.prisma.encounter.findMany({
      where: {
        OR: [
          hospitalIds.length > 0 ? { hospitalId: { in: hospitalIds } } : null,
          patientIds.length > 0 ? { patientId: { in: patientIds } } : null,
        ].filter(Boolean),
      },
      select: { id: true },
    });
    const encounterIds = encounters.map((entry) => entry.id);

    const patientSessions = await this.prisma.patientSession.findMany({
      where: {
        OR: [
          patientIds.length > 0 ? { patientId: { in: patientIds } } : null,
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
        ].filter(Boolean),
      },
      select: { id: true },
    });
    const patientSessionIds = patientSessions.map((entry) => entry.id);

    const intakeSessions = await this.prisma.intakeSession.findMany({
      where: {
        OR: [
          hospitalIds.length > 0 ? { hospitalId: { in: hospitalIds } } : null,
          patientIds.length > 0 ? { patientId: { in: patientIds } } : null,
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
          patientSessionIds.length > 0 ? { authSessionId: { in: patientSessionIds } } : null,
        ].filter(Boolean),
      },
      select: { id: true },
    });
    const intakeSessionIds = intakeSessions.map((entry) => entry.id);

    const correlatedLogs = await this.prisma.logRecord.findMany({
      where: {
        OR: [
          hospitalIds.length > 0 ? { hospitalId: { in: hospitalIds } } : null,
          userIds.length > 0 ? { userId: { in: userIds } } : null,
          patientIds.length > 0 ? { patientId: { in: patientIds } } : null,
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
        ].filter(Boolean),
        correlationId: { not: null },
      },
      select: { correlationId: true },
      distinct: ['correlationId'],
    });
    const correlationIds = correlatedLogs
      .map((entry) => entry.correlationId)
      .filter(Boolean);

    await this.prisma.encounterReadCursor.deleteMany({
      where: {
        OR: [
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
          userIds.length > 0 ? { userId: { in: userIds } } : null,
          patientIds.length > 0 ? { patientId: { in: patientIds } } : null,
        ].filter(Boolean),
      },
    });
    await this.prisma.message.deleteMany({
      where: {
        OR: [
          hospitalIds.length > 0 ? { hospitalId: { in: hospitalIds } } : null,
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
        ].filter(Boolean),
      },
    });
    await this.prisma.alert.deleteMany({
      where: {
        OR: [
          hospitalIds.length > 0 ? { hospitalId: { in: hospitalIds } } : null,
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
        ].filter(Boolean),
      },
    });
    await this.prisma.triageAssessment.deleteMany({
      where: {
        OR: [
          hospitalIds.length > 0 ? { hospitalId: { in: hospitalIds } } : null,
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
          userIds.length > 0 ? { createdByUserId: { in: userIds } } : null,
        ].filter(Boolean),
      },
    });
    await this.prisma.encounterEvent.deleteMany({
      where: {
        OR: [
          hospitalIds.length > 0 ? { hospitalId: { in: hospitalIds } } : null,
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
          userIds.length > 0 ? { actorUserId: { in: userIds } } : null,
          patientIds.length > 0 ? { actorPatientId: { in: patientIds } } : null,
        ].filter(Boolean),
      },
    });
    await this.prisma.asset.deleteMany({
      where: {
        OR: [
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
          patientSessionIds.length > 0 ? { patientSessionId: { in: patientSessionIds } } : null,
          intakeSessionIds.length > 0 ? { intakeSessionId: { in: intakeSessionIds } } : null,
          patientIds.length > 0 ? { createdByPatientId: { in: patientIds } } : null,
          userIds.length > 0 ? { createdByUserId: { in: userIds } } : null,
        ].filter(Boolean),
      },
    });
    await this.prisma.contextItem.deleteMany({
      where: {
        OR: [
          patientIds.length > 0 ? { patientId: { in: patientIds } } : null,
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
          intakeSessionIds.length > 0 ? { intakeSessionId: { in: intakeSessionIds } } : null,
        ].filter(Boolean),
      },
    });
    await this.prisma.summaryProjection.deleteMany({
      where: {
        OR: [
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
          intakeSessionIds.length > 0 ? { intakeSessionId: { in: intakeSessionIds } } : null,
        ].filter(Boolean),
      },
    });
    await this.prisma.partnerReference.deleteMany({
      where: {
        OR: [
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
          intakeSessionIds.length > 0 ? { intakeSessionId: { in: intakeSessionIds } } : null,
        ].filter(Boolean),
      },
    });
    await this.prisma.commandResult.deleteMany({
      where: {
        OR: [
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
          intakeSessionIds.length > 0 ? { intakeSessionId: { in: intakeSessionIds } } : null,
        ].filter(Boolean),
      },
    });
    if (correlationIds.length > 0) {
      await this.prisma.errorReportSnapshot.deleteMany({
        where: { correlationId: { in: correlationIds } },
      });
    }
    await this.prisma.logRecord.deleteMany({
      where: {
        OR: [
          hospitalIds.length > 0 ? { hospitalId: { in: hospitalIds } } : null,
          userIds.length > 0 ? { userId: { in: userIds } } : null,
          patientIds.length > 0 ? { patientId: { in: patientIds } } : null,
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
        ].filter(Boolean),
      },
    });
    await this.prisma.intakeSession.deleteMany({
      where: { id: { in: intakeSessionIds } },
    });
    await this.prisma.patientSession.deleteMany({
      where: {
        OR: [
          patientIds.length > 0 ? { patientId: { in: patientIds } } : null,
          encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
        ].filter(Boolean),
      },
    });
    await this.prisma.encounter.deleteMany({
      where: { id: { in: encounterIds } },
    });
    await this.prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    await this.prisma.hospitalConfig.deleteMany({
      where: { hospitalId: { in: hospitalIds } },
    });
    await this.prisma.hospital.deleteMany({
      where: { id: { in: hospitalIds } },
    });
    await this.prisma.patientProfile.deleteMany({
      where: { id: { in: patientIds } },
    });
  }
}

function pushUnique(list, value) {
  if (Number.isInteger(value) && !list.includes(value)) {
    list.push(value);
  }
}

function uniqueIntegers(values) {
  return [...new Set(values.filter((value) => Number.isInteger(value)))];
}

module.exports = {
  TestFixtureTracker,
};
