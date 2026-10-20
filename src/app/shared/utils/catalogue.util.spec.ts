import { emptyServiceContent, ServiceContent } from '../models/catalogue.model';
import { joinPt, lines, missingServiceFields, paragraphs, slugify } from './catalogue.util';
import { serviceViewFromContent } from './catalogue-views.util';

describe('catalogue.util', () => {
  it('splits paragraphs on blank lines and lists on lines', () => {
    expect(paragraphs('Um.\n\nDois.\n  \nTrês.')).toEqual(['Um.', 'Dois.', 'Três.']);
    expect(lines('a\n\n b \n')).toEqual(['a', 'b']);
  });

  it('joins in Portuguese', () => {
    expect(joinPt([])).toBe('');
    expect(joinPt(['Adultos'])).toBe('Adultos');
    expect(joinPt(['Adultos', 'Casais', 'Famílias'])).toBe('Adultos, Casais e Famílias');
  });

  it('builds the same addresses as the backend', () => {
    expect(slugify('Análise Corporal Reichiana')).toBe('analise-corporal-reichiana');
    expect(slugify('Somatic Experiencing®')).toBe('somatic-experiencing');
    expect(slugify('  Luane Bastos ')).toBe('luane-bastos');
  });

  it('lists what is missing in a service, in form order', () => {
    const c: ServiceContent = { ...emptyServiceContent(), allowsPublic: false };
    c.specialties = [{ id: null, name: ' ', description: null, audienceIds: [], proposedAudiences: [] }];
    expect(missingServiceFields(c)).toEqual([
      'nome do serviço',
      'modalidade',
      'formato',
      'visibilidade',
      'público',
      'texto de apresentação',
      'especialidade 1: nome',
    ]);
  });

  it('accepts a proposed audience instead of a listed one', () => {
    const c: ServiceContent = {
      ...emptyServiceContent(),
      name: 'Terapia de Casal',
      intro: 'Um espaço para o casal.',
      allowsIndividual: true,
      allowsRemote: true,
      proposedAudiences: ['Casais'],
    };
    expect(missingServiceFields(c)).toEqual([]);
  });

  it('previews a form with listed and proposed audiences by name', () => {
    const c: ServiceContent = {
      ...emptyServiceContent(),
      name: 'Terapia de Casal',
      intro: 'Um.\n\nDois.',
      allowsIndividual: true,
      allowsRemote: true,
      allowsPublic: false,
      allowsPrivate: true,
      audienceIds: [4],
      specialties: [{ id: null, name: 'Casais LGBT', description: null, audienceIds: [], proposedAudiences: ['LGBT+'] }],
    };
    const view = serviceViewFromContent(c, { audiences: [{ id: 4, name: 'Casais', pending: false }], languages: [] });
    expect(view.intro).toEqual(['Um.', 'Dois.']);
    expect(view.audiences).toEqual(['Casais']);
    expect(view.specialties[0].audiences).toEqual(['LGBT+']);
    expect(view.privateOnly).toBe(true);
    expect(view.formats).toEqual(['INDIVIDUAL']);
    expect(view.modalities).toEqual(['REMOTE']);
  });
});
