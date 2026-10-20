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
              A CARE reúne pessoas profissionais que compreendem o cuidado em saúde mental para além da ausência de
              doença, e que trabalham a partir da integralidade da pessoa: corpo, vivências, vínculos e contexto social.
            </p>
            <p>
              Se a sua prática se reconhece nesta perspectiva, poderá enviar um pedido para fazer parte da clínica. O
              pedido é feito através de um formulário, que reúne as informações que irão compor o seu perfil na
              plataforma.
            </p>
          </div>
          <img class="cat-join-illustration" src="assets/images/hands3.svg" alt="" />
        </div>

        <div class="cat-block">
          <h2>O que sustenta cada atendimento</h2>
          <p>As pessoas profissionais da CARE partilham quatro pilares, que orientam a forma como o acompanhamento é construído.</p>
          <dl class="cat-rows">
            <div class="cat-row"><dt>Cuidado centrado na pessoa</dt><dd>Cada plano de cuidado é único e feito para a pessoa, não para um protocolo.</dd></div>
            <div class="cat-row"><dt>Abordagem integral</dt><dd>Corpo, vivências e vínculos entram na mesma sala. Todos são protagonistas.</dd></div>
            <div class="cat-row"><dt>Trabalho transdisciplinar</dt><dd>Abordagem que supera a fragmentação dos saberes e os integra em diálogo.</dd></div>
            <div class="cat-row"><dt>Modelo biopsicossocial</dt><dd>Saúde como estado de bem viver e não como ausência de doença.</dd></div>
          </dl>
        </div>

        <div class="cat-block">
          <h2>Como funciona o pedido</h2>
          <ol class="cat-steps">
            <li>
              <span class="cat-step-n">1</span>
              <h3>Envio do formulário</h3>
              <p>
                Com a sua conta na Care, preencha a apresentação, a formação, a forma de trabalho e as informações
                práticas. É possível ver, enquanto escreve, como o perfil ficará na plataforma. No mesmo formulário,
                poderá também propor um novo serviço.
              </p>
            </li>
            <li>
              <span class="cat-step-n">2</span>
              <h3>Análise pela equipa da CARE</h3>
              <p>A equipa lê o pedido com atenção e poderá solicitar documentos que comprovem a formação indicada.</p>
            </li>
            <li>
              <span class="cat-step-n">3</span>
              <h3>Conversa</h3>
              <p>
                Um encontro para conhecer a sua prática e esclarecer, de parte a parte, o que significa trabalhar na
                clínica ampliada.
              </p>
            </li>
            <li>
              <span class="cat-step-n">4</span>
              <h3>Publicação do perfil</h3>
              <p>
                O perfil e os serviços aprovados são publicados na plataforma. Novas propostas de serviço podem ser
                enviadas a qualquer momento, a partir do seu perfil.
              </p>
            </li>
          </ol>
        </div>

        @if (!signedIn()) {
          <p class="cat-hint">Para enviar o pedido, entre na sua conta ou crie uma — volta logo a seguir ao formulário.</p>
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
