export interface Professional {
  id: number;
  name: string;
  picture: string;
  bio: string;
  /** No Agendar: a oferta desta pessoa do serviço escolhido (é ela que se marca). */
  offeringId?: number;
  /** Endereço do perfil profissional publicado, se tem. */
  slug?: string | null;
  /** Públicos que atende neste serviço. */
  audiences?: { id: number; name: string }[];
}

export const emptyProfessionalService: Professional = {
  id: 0,
  name: 'SAMPLE_NAME',
  picture: '',
  bio: 'Sample bio',
};
