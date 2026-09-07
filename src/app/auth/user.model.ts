import { Currency } from '../shared/enums/currency.enum';
import { Genders } from '../shared/enums/genders.enum';
import { Roles } from '../shared/enums/roles.enum';

export interface User {
  id?: number;
  name?: string;
  email: string;
  birthDate?: string;
  phone?: string;
  gender?: Genders;
  bio?: string;
  picture?: string | null;
  roles: string[];
  profileCompleted: boolean;
  /** Moeda em que a pessoa é cobrada. O cliente nunca converte valores. */
  currency?: Currency;
  /** Fuso IANA guardado no perfil — base do UserTimePipe. */
  timeZone?: string;
  /** Instante ISO em UTC da próxima sessão — alimenta o exemplo em Preferências. */
  nextAppointmentAt?: string;
}

export const emptyUser: User = {
  name: 'SAMPLE_NAME',
  email: 'SAMPLE_EMAIL@EMAIL.COM',
  roles: [Roles.USER],
  profileCompleted: false,
};
