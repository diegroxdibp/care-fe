import { environment } from './../environments/environment';
import { NavbarBackground } from './shared/enums/navbar-background.enum';
import { Pages } from './shared/enums/pages.enum';
import { FaqTopic, FaqTopicItem } from './shared/models/faq.model';
import { Service } from './shared/models/service.model';

export const AppConstants = {
  apiEndpoints: {
    me: `${environment.apiUrl}/api/auth/me`,
    register: `${environment.apiUrl}/api/auth/register`,
    onboarding: `${environment.apiUrl}/api/user/onboarding`,
    updateProfile: `${environment.apiUrl}/api/user/profile`,
    getProfile: `${environment.apiUrl}/api/user/profile`,
    login: `${environment.apiUrl}/api/auth/login`,
    logout: `${environment.apiUrl}/api/auth/logout`,
    forgotPassword: `${environment.apiUrl}/api/auth/forgot-password`,
    resetPassword: `${environment.apiUrl}/api/auth/reset-password`,
    confirmEmail: `${environment.apiUrl}/api/auth/confirm-email`,
    resendConfirmation: `${environment.apiUrl}/api/auth/resend-confirmation`,
    deleteAccount: `${environment.apiUrl}/api/user`,
    requestAccountDeletion: `${environment.apiUrl}/api/user/request-deletion`,
    loginWithGoogle: `${environment.apiUrl}/oauth2/authorization/google`,
  },
  authentication: {
    exists: true,
    emailInputTitle: 'Email:',
    passwordInputTitle: 'Password:',
    nameInputTitle: 'Nome:',
    poneNumberTitle: 'Telefone:',
    birthdateTitle: 'Birthdate:',
    genderTitle: 'Gênero:',
    bioTitle: 'Bio:',
  },

  defaultCountry: 'pt',

  navigation: {
    background: NavbarBackground.White,
    height: 70,
  },

  scheduling: {
    minDate: new Date(),
    maxDate: new Date(new Date().setMonth(new Date().getMonth() + 2)),
  },

  birthdate: {
    minDate: new Date(new Date().setFullYear(new Date().getFullYear() - 18)),
    maxDate: new Date(new Date().setFullYear(new Date().getFullYear() - 100)),
  },

  services: [
    {
      name: 'Atendimento individual',
      cardDescription:
        'Atendimentos individuais com psicóloga, visando o autoconhecimento e o restabelecimento da saúde mental.',
      serviceType: [
        {
          name: 'Análise Corporal Reichiana',
          description:
            'A análise corporal reichiana reintegra a terapia verbal à análise do corpo e tem como objetivo flexibilizar os bloqueios somáticos, considerando o ser humano como uma unidade psicossomática, na qual corpo e mente formam um sistema indissociável.',
          knowMorePage: Pages.ANALISE_REICHANA,
          sessionService: 'REICHIAN_BODY_ANALYSIS',
          meta: 'Presencial (Lisboa) e Remoto · Adultos',
        },

        {
          name: 'Mindfulness',
          description:
            'A prática em Mindfulness fomenta a regulação atencional e emocional por meio de propostas com o body scan, a respiração consciente, a meditação em movimento e a atenção plena nas atividades cotidianas.',
          knowMorePage: Pages.MINDFULLNESS,
          sessionService: 'MINDFULNESS',
          meta: 'Presencial (Lisboa) e Remoto · Adultos',
        },

        {
          name: 'Somatic Experiencing®',
          description:
            'A Somatic Experiencing® (SE) é uma prática centrada na regulação do sistema nervoso e na elaboração de experiências traumáticas através do corpo. Por meio de intervenções seguras e graduais, a SE possibilita a renegociação das respostas traumáticas, reduzindo sintomas de diversas naturezas e fortalecendo a capacidade natural de autorregulação do organismo.',
          knowMorePage: Pages.SOMATIC_EXPERIENCE,
          sessionService: 'SOMATIC_EXPERIENCE',
          meta: 'Presencial (Lisboa) e Remoto · Adultos',
        },
      ],
      available: true,
    } as Service,

    {
      name: 'Atendimento em grupo',
      cardDescription:
        'Atendimentos em grupo com psicóloga, visando o autoconhecimento e o restabelecimento da saúde mental.',
      serviceType: [
        {
          name: 'Autorregulação para Profissionais',
          description: 'Estamos chegando com um novo jeito de cuidar. Em breve, mais informações.',
          meta: 'Remoto · Adultos',
        },
      ],
      available: false,
    } as Service,

    {
      name: 'Para profissionais',
      cardDescription: 'Serviços orientados para profissionais.',
      serviceType: [
        {
          name: 'Supervisão',
          description:
            'A supervisão na abordagem da Análise Corporal Reichiana ocorre individual e em grupos pequenos, com ênfase no atendimento individual de adultos. São encontros semanais, quinzenais ou mensais no formato presencial (em Lisboa) ou remoto.',
          knowMorePage: Pages.SUPERVISION,
          sessionService: 'SUPERVISION',
          meta: 'Individual ou grupal · Presencial (Lisboa) e Remoto',
        },
      ],
      available: true,
    } as Service,
  ],

  faq: [
    {
      topicName: 'Consulta',
      items: [
        {
          question: 'Qual a duração de uma consulta?',
          answer: {
            intro: 'Cada profissional estipula sua própria duração. Como referência, a maioria das consultas tem entre 30 minutos e 2 horas.',
          },
        } as FaqTopicItem,
        {
          question: 'Há consulta no formato online?',
          answer: {
            intro: 'Sim. O profissional escolhe a plataforma que utiliza. Alguns serviços também oferecem atendimento presencial. As modalidades disponíveis aparecem no momento do agendamento.',
          },
        } as FaqTopicItem,
        {
          question: 'Como faço o cancelamento de uma consulta?',
          answer: {
            intro: 'Pelo perfil no botão “Agendamentos” é possível cancelar ou reagendar uma consulta já marcada.',
          },
        } as FaqTopicItem,
      ],
    } as FaqTopic,
    {
      topicName: 'Agendamento',
      items: [
        {
          question: 'Como faço um agendamento?',
          answer: {
            intro: "O processo exige login primeiro. Depois pode clicar no botão “Agendar” no menu de navegação no topo da página e  escolher o serviço, a pessoa profissional e, então, visualizar a agenda (horários disponíveis, modalidade de atendimento e valor). \n" +
              "O agendamento também pode ser feito através do perfil no botão \"+ Agendar Sessão\".\n",
          },
        } as FaqTopicItem,
        {
          question: 'É obrigatório fazer Log in para iniciar o agendamento?',
          answer: {
            intro: 'Sim, é obrigatório. Não há custo para criar ou manter o login.',
          },
        } as FaqTopicItem,
        {
          question: 'Como tenho acesso à agenda de cada profissional?',
          answer: {
            intro: 'O acesso ocorre após o Log in e a escolha do serviço e da pessoa profissional. A agenda com datas e horários será disponibilizada.',
          },
        } as FaqTopicItem,
        {
          question: 'Como cancelar um agendamento?',
          answer: {
            intro: 'Através do perfil no botão “Cancelar Sessão”.',
          },
        } as FaqTopicItem,
        {
          question: 'Depois do primeiro atendimento com uma pessoa profissional ou grupo, terei de agendar os seguintes atendimentos através da CARE?',
          answer: {
            intro: 'Não é obrigatório. Os agendamentos seguintes podem ser negociados diretamente com a pessoa profissional no primeiro atendimento ou grupo.',
          },
        } as FaqTopicItem,
      ],
    } as FaqTopic,
    {
      topicName: 'Clínica',
      items: [
        {
          question: 'O que é a CARE?',
          answer: {
            intro: 'CARE significa Clínica Ampliada Ressignificações. Tem como missão impulsionar e garantir a acessibilidade a cuidados de saúde mental, relacional, física e social. Seus valores desafiam modelos tradicionais que ignoram a integralidade do ser humano e reduzem a saúde à mera ausência de doença.',
          },
        } as FaqTopicItem,
        {
          question: 'Quais os serviços disponibilizados na CARE?',
          answer: {
            intro: 'Atualmente a CARE disponibiliza os seguintes serviços:',
            steps: [
              'Análise Reichiana — abordagem psicanalítica com enfoque no corpo;',
              'Mindfulness — prática de atenção plena;',
              'Somatic Experiencing® — voltado à regulação do sistema nervoso autônomo e à renegociação de trauma;',
              'Autorregulação para Profissionais — informações em breve',
              'Supervisão na abordagem Reichiana — destinada a profissionais.',
            ],
            outro: 'Os serviços podem mudar e estarão sempre atualizados na página principal (Home).',
          },
        } as FaqTopicItem,
      ],
    } as FaqTopic,
    {
      topicName: 'Política de privacidade e Termo de uso',
      items: [
        {
          question: 'O que é Política de Privacidade e Termo de Uso?',
          answer: {
            intro: 'A Política de Privacidade contém informações acerca da utilização e coleta de dados pessoais, além de explicitar o tratamento, a transparência e a segurança dos mesmos.',
            outro: 'O Termo de Uso enuncia as regras de utilização da plataforma, assim como os direitos, deveres e responsabilidades das partes, e define políticas de desistência, suspensão e bloqueio do usuário.',
            links: [
              { label: 'Aceda a ambos os documentos aqui', url: '/politica-privacidade' },
            ],
          },
        } as FaqTopicItem,
        {
          question: 'Errei um dado pessoal ao me inscrever na plataforma. Como faço para retificar meus dados?',
          answer: {
            intro: 'É possível corrigir os dados a qualquer momento. Basta fazer Log in, aceder ao “Perfil” e realizar as correções.',
          },
        } as FaqTopicItem,
        {
          question: 'Pessoas menores de 18 anos podem se inscrever na CARE?',
          answer: {
            intro: 'Não. O serviço é destinado exclusivamente a pessoas com 18 anos ou mais.',
          },
        } as FaqTopicItem,
        {
          question: 'Com quem meus dados são compartilhados?',
          answer: {
            intro: 'Os dados da conta (nome, contato telefônico e email) são compartilhados apenas com a pessoa profissional com quem tem ou teve atendimento. Não compartilhamos dados com terceiros para fins de marketing ou outras finalidades alheias aos serviços da CARE.',
          },
        } as FaqTopicItem,
        {
          question: 'Posso excluir permanentemente minha conta e meus dados?',
          answer: {
            intro: 'Sim. Basta aceder ao “Perfil” e clicar na opção de “Apagar conta”. Após a exclusão, os seus dados pessoais serão removidos do sistema ativo.',
            outro: 'Importante: atualmente, não há registros clínicos armazenados na plataforma. Caso o profissional mantenha seus próprios registros fora da CARE, a exclusão da sua conta na plataforma não afeta esses arquivos externos.',
          },
        } as FaqTopicItem,
        {
          question: 'Como serei notificado sobre mudanças na política ou termos?',
          answer: {
            intro: 'As notificações sobre alterações na Política de Privacidade ou no Termo de Uso aparecerão no seu perfil.',
            links: [
              { label: 'A versão atualizada dos documentos está sempre disponível aqui', url: '/politica-privacidade' },
            ],
          },
        } as FaqTopicItem,
        {
          question: 'A plataforma utiliza cookies?',
          answer: {
            intro: 'Sim. A CARE utiliza cookies apenas para autenticação, ou seja, para manter a sua sessão ativa enquanto navega na área logada. Não usamos cookies para rastreamento de comportamento, anúncios ou marketing.',
            outro: 'Pode configurar o seu navegador para recusar cookies, mas isso pode comprometer o funcionamento do login e do agendamento.',
          },
        } as FaqTopicItem,
        {
          question: 'O que acontece se eu descumprir o Termo de Uso?',
          answer: {
            intro: 'O descumprimento pode resultar em advertência, suspensão ou exclusão da conta. Você será informado e poderá contestar, exceto em casos graves. A CARE pode reter dados apenas pelo prazo exigido por lei.',
            links: [
              { label: 'Consulte os detalhes no Termo de Uso', url: '/termos-uso' },
            ],
          },
        } as FaqTopicItem,
      ],
    } as FaqTopic,
  ]
};
