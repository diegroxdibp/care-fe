import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { Pages } from '../../../shared/enums/pages.enum';
import { SessionService } from '../../../shared/services/session.service';

/**
 * /junte-se — o convite a fazer parte da Care. "Enviar pedido" leva ao
 * formulário (/junte-se/pedido), que pede sessão: quem não tem conta cria uma
 * primeiro e volta lá (return path). Textos provisórios — validar com a Care.
 */
@Component({
  selector: 'app-join-us',
  standalone: true,
  template: `
    <div class="cat-page">
      <div class="cat-col">
        <div class="cat-whoami">
          <div class="cat-block">
            <h1>Junte-se à CARE</h1>
            <p>
              A CARE nasce da convicção de que o cuidado pode ser integral quando diferentes áreas de conhecimento
              dialogam e colaboram, respeitando as particularidades de cada pessoa e de cada prática profissional.
            </p>
            <p>
              Se valoriza esta perspectiva e procura um espaço que reconheça a importância do trabalho transdisciplinar,
              poderá candidatar-se a integrar a CARE.
            </p>
            <p>Para isso, basta preencher um formulário e aguardar o contato da equipe da CARE.</p>
          </div>
          <img class="cat-join-illustration" src="assets/images/hands3.svg" alt="" />
        </div>

        <div class="cat-block">
          <h2>O que sustenta cada acompanhamento</h2>
          <p>Os quatro pilares da CARE reconhecem a complexidade humana e valorizam a construção conjunta do acompanhamento.</p>
          <dl class="cat-rows">
            <div class="cat-row"><dt>Cuidado centrado na pessoa</dt><dd>Cada plano de cuidado é construído a partir das necessidades, da história e da realidade de cada pessoa, em vez de seguir apenas um protocolo.</dd></div>
            <div class="cat-row"><dt>Abordagem integral</dt><dd>O corpo, as vivências, os vínculos e todas as dimensões da complexidade humana são considerados na mesma escuta.</dd></div>
            <div class="cat-row"><dt>Trabalho transdisciplinar</dt><dd>Diferentes áreas de conhecimento dialogam e integram os seus saberes, ampliando a compreensão e a construção do cuidado.</dd></div>
            <div class="cat-row"><dt>Modelo biopsicossocial</dt><dd>A saúde é compreendida não apenas como ausência de doença, mas, sobretudo, como um estado de bem viver.</dd></div>
          </dl>
        </div>

        <div class="cat-block">
          <h2>Como funciona a candidatura</h2>
          <ol class="cat-steps">
            <li>
              <span class="cat-step-n">1</span>
              <h3>Envio do formulário</h3>
              <p>
                A partir da sua conta na CARE, preencha as informações sobre o seu percurso profissional, a sua
                formação e os aspectos práticos do trabalho. Enquanto preenche o formulário, poderá acompanhar como
                ficará o seu perfil na plataforma. Também poderá propor um novo serviço nesta etapa.
              </p>
            </li>
            <li>
              <span class="cat-step-n">2</span>
              <h3>Análise pela equipe da CARE</h3>
              <p>A equipe da CARE analisa a candidatura com atenção e agenda uma conversa.</p>
            </li>
            <li>
              <span class="cat-step-n">3</span>
              <h3>Conversa</h3>
              <p>
                Um momento de encontro e diálogo para conhecer melhor a sua prática, esclarecer dúvidas e conversar
                sobre o que significa trabalhar a partir da perspectiva da clínica ampliada.
              </p>
            </li>
            <li>
              <span class="cat-step-n">4</span>
              <h3>Publicação do perfil</h3>
              <p>
                Após a aprovação, o perfil e os serviços aprovados são publicados na plataforma. Poderá também
                apresentar novas propostas de serviço a qualquer momento, diretamente a partir do seu perfil.
              </p>
            </li>
          </ol>
        </div>

        @if (!signedIn()) {
          <p class="cat-hint">
            Para enviar a sua candidatura, entre na sua conta ou crie uma nova. Depois, volte a esta página para
            preencher o formulário.
          </p>
        }
        <button class="cat-cta" type="button" (click)="apply()">Enviar pedido</button>
      </div>
    </div>
  `,
  styles: `
    .cat-join-illustration {
      width: 240px;
      max-width: 60%;
      flex: none;
      align-self: center;
    }
  `,
})
export class JoinUsComponent {
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  signedIn(): boolean {
    return !!this.session.user();
  }

  apply(): void {
    this.router.navigate(['/', ...Pages.JUNTE_SE_PEDIDO.split('/')]);
  }
}
