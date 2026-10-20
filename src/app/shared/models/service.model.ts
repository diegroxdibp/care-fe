import { Pages } from '../enums/pages.enum';

export interface Services {
  service: Service[]
}


export interface Service {
  name: string;
  cardDescription: string;
  serviceType: ServiceType[];
  available: boolean;
}

export interface ServiceType {
  name: string;
  description: string;
  knowMorePage: Pages;
  /** O endereço (slug) do serviço na lista, para o Agendar (?service=). Omitir para os que não se agendam. */
  sessionService?: string;
  /** Short modality/audience summary shown under the offering's name, e.g. "Individual · Adultos (18+)". */
  meta?: string;
}
