import { environment } from './../environments/environment';
import { NavbarBackground } from './shared/enums/navbar-background.enum';
import { Pages } from './shared/enums/pages.enum';
import { FaqTopic, FaqTopicItem } from './shared/models/faq.model';

export const AppConstants = {
  apiEndpoints: {
    me: `${environment.apiUrl}/api/auth/me`,
    register: `${environment.apiUrl}/api/auth/register`,
    onboarding: `${environment.apiUrl}/api/user/onboarding`,
    updateProfile: `${environment.apiUrl}/api/user/profile`,
    getProfile: `${environment.apiUrl}/api/user/profile`,
    profilePicture: `${environment.apiUrl}/api/user/profile/picture`,
    emailChange: `${environment.apiUrl}/api/user/email-change`,
    confirmEmailChange: `${environment.apiUrl}/api/auth/confirm-email-change`,
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
            // Sem lista aqui: a da home vem da API e é sempre a atual.
            intro: 'Os serviços abertos para agendamento estão na seção “Serviços” da página inicial, sempre atualizados. Cada um tem uma página com o que é, para quem é e quem o oferece.',
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
              { label: 'Acesse ambos os documentos aqui', url: '/politica-privacidade' },
            ],
          },
        } as FaqTopicItem,
        {
          question: 'Errei um dado pessoal ao me inscrever na plataforma. Como faço para retificar meus dados?',
          answer: {
            intro: 'É possível corrigir os dados a qualquer momento. Basta fazer Log in, acessar o “Perfil” e realizar as correções.',
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
            intro: 'Sim. Basta acessar o “Perfil” e clicar na opção de “Apagar conta”. Após a exclusão, seus dados pessoais serão removidos do sistema ativo.',
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
            intro: 'Sim. A CARE utiliza cookies apenas para autenticação, ou seja, para manter sua sessão ativa enquanto navega na área logada. Não usamos cookies para rastreamento de comportamento, anúncios ou marketing.',
            outro: 'Você pode configurar seu navegador para recusar cookies, mas isso pode comprometer o funcionamento do login e do agendamento.',
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
