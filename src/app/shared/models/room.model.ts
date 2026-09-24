export type RoomAccessMode = 'SPECIFIC_USERS' | 'ANYONE_WITH_LINK';

export interface RoomAllowedUser {
  id: number;
  name: string;
  email: string;
  picture?: string | null;
}

export interface Room {
  id: number;
  name?: string;
  accessMode: RoomAccessMode;
  allowedUsers: RoomAllowedUser[];
  maxParticipants?: number;
  opensAt: string;
  closesAt: string;
  /** Já aponta para o frontend, pronto a partilhar. */
  joinLink: string;
  createdAt: string;
}

export interface CreateRoomPayload {
  name?: string;
  accessMode: RoomAccessMode;
  allowedUserIds: number[];
  maxParticipants?: number;
  /** Omitido/null cria a sala já disponível ("Agora"). */
  opensAt?: string | null;
  durationMinutes: number;
}
