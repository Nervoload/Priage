const { Role } = require('@prisma/client');

async function resolveTargetHospital(prisma, argv = process.argv.slice(2), env = process.env) {
  const { hospitalId, hospitalSlug } = parseTargetArgs(argv, env);

  if (hospitalId) {
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, name: true, slug: true },
    });
    if (!hospital) {
      throw new Error(`Hospital ${hospitalId} was not found.`);
    }
    return hospital;
  }

  if (hospitalSlug) {
    const hospital = await prisma.hospital.findUnique({
      where: { slug: hospitalSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!hospital) {
      throw new Error(`Hospital ${hospitalSlug} was not found.`);
    }
    return hospital;
  }

  const hospitals = await prisma.hospital.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });

  if (hospitals.length === 1) {
    return hospitals[0];
  }

  if (hospitals.length === 0) {
    throw new Error(
      'No hospitals exist yet. Run ./priage-dev interactively first to create a private admin and hospital.',
    );
  }

  throw new Error(
    'Multiple hospitals exist. Re-run with --hospital-slug <slug>, --hospital-id <id>, or TARGET_HOSPITAL_SLUG/TARGET_HOSPITAL_ID.',
  );
}

async function resolveHospitalActors(prisma, hospitalId) {
  const users = await prisma.user.findMany({
    where: { hospitalId },
    select: {
      id: true,
      email: true,
      role: true,
      hospitalId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (users.length === 0) {
    throw new Error(
      `Hospital ${hospitalId} has no staff users. Create a private admin with ./priage-dev before seeding demo data.`,
    );
  }

  return {
    allUsers: users,
    adminUser: pickUser(users, [Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.STAFF]),
    nurseUser: pickUser(users, [Role.NURSE, Role.DOCTOR, Role.ADMIN, Role.STAFF]),
    doctorUser: pickUser(users, [Role.DOCTOR, Role.NURSE, Role.ADMIN, Role.STAFF]),
    staffUser: pickUser(users, [Role.STAFF, Role.ADMIN, Role.NURSE, Role.DOCTOR]),
  };
}

function parseTargetArgs(argv, env) {
  let hospitalId = env.TARGET_HOSPITAL_ID ? Number.parseInt(env.TARGET_HOSPITAL_ID, 10) : null;
  let hospitalSlug = env.TARGET_HOSPITAL_SLUG || env.PRIAGE_DEV_ADMIN_HOSPITAL_SLUG || null;

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--hospital-id' && argv[index + 1]) {
      hospitalId = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }

    if (argv[index] === '--hospital-slug' && argv[index + 1]) {
      hospitalSlug = argv[index + 1];
      index += 1;
    }
  }

  return {
    hospitalId: Number.isInteger(hospitalId) && hospitalId > 0 ? hospitalId : null,
    hospitalSlug: hospitalSlug?.trim() || null,
  };
}

function pickUser(users, preferredRoles) {
  for (const role of preferredRoles) {
    const match = users.find((user) => user.role === role);
    if (match) {
      return match;
    }
  }

  return users[0] ?? null;
}

module.exports = {
  resolveHospitalActors,
  resolveTargetHospital,
};
