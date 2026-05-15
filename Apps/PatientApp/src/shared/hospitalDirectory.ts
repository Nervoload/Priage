import type { Hospital } from './types/domain';

export type PatientCoordinates = {
  latitude: number;
  longitude: number;
};

export function getHospitalDestinationLabel(hospital: Hospital): string {
  return hospital.address?.trim() || hospital.name;
}

export function getGoogleMapsDirectionsUrl(
  hospital: Hospital,
  origin?: PatientCoordinates | null,
): string {
  const params = new URLSearchParams({
    api: '1',
    destination: getHospitalDestinationLabel(hospital),
  });

  if (origin) {
    params.set('origin', `${origin.latitude},${origin.longitude}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function getAppleMapsDirectionsUrl(
  hospital: Hospital,
  origin?: PatientCoordinates | null,
): string {
  const params = new URLSearchParams({
    daddr: getHospitalDestinationLabel(hospital),
    dirflg: 'd',
  });

  if (origin) {
    params.set('saddr', `${origin.latitude},${origin.longitude}`);
  }

  return `https://maps.apple.com/?${params.toString()}`;
}

export function getHospitalDistanceKm(
  hospital: Hospital,
  origin?: PatientCoordinates | null,
): number | null {
  if (!origin || !hospital.coordinates) {
    return null;
  }

  return haversineDistanceKm(origin, hospital.coordinates);
}

export function formatHospitalDistance(distanceKm: number | null): string | null {
  if (distanceKm === null || !Number.isFinite(distanceKm)) {
    return null;
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }

  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km away`;
}

function haversineDistanceKm(first: PatientCoordinates, second: PatientCoordinates): number {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
