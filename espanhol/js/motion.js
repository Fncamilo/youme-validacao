/*!
 * RC — base de motion compartilhada da skill "redesign-cinematografico".
 * Script clássico (sem módulos). Carregar com `defer` DEPOIS de gsap/ScrollTrigger/Lenis
 * e ANTES dos snippets. Contrato completo em ../_base/README.md.
 *
 * Princípio: o CSS já mostra tudo. Este arquivo só adiciona movimento por cima;
 * se ele (ou uma lib) falhar, a página continua inteira e clicável.
 */
(function (w, d) {
  'use strict';

  // Snippets carregados antes deste arquivo podem enfileirar: (window.RC ||= {fila: []}).fila.push([nome, fn])
  var anterior = w.RC && typeof w.RC === 'object' ? w.RC : {};
  var filaPrevia = Array.isArray(anterior.fila) ? anterior.fila.slice() : [];

  var PERFIS = Object.freeze({
    completo: '(min-width: 800px) and (prefers-reduced-motion: no-preference)',
    reduzido: '(max-width: 799px) and (prefers-reduced-motion: no-preference)',
    estatico: '(prefers-reduced-motion: reduce)',
  });

  var TRAVA_CTA_MS = 1500;
  var TETO_FONTES_MS = 3000; // document.fonts.ready pode nunca resolver em rede ruim

  var registros = Object.create(null); // nome -> fn
  var montagens = []; // instâncias de gsap.matchMedia()
  var tickLenis = null;
  var timerTrava = null;
  var estado = { booted: false, falhou: false, motivo: null, plugins: [] };

  var resolverPronto;
  var RC = {
    versao: '1.0.0',
    perfis: PERFIS,
    lenis: null,
    estado: estado,
    fila: [],
    pronto: new Promise(function (r) { resolverPronto = r; }),
    registrar: registrar,
    perfilAtual: perfilAtual,
  };
  w.RC = RC;

  function log(tipo, msg, extra) {
    if (w.console && console[tipo]) console[tipo]('[RC] ' + msg, extra === undefined ? '' : extra);
  }

  function perfilAtual() {
    if (!w.matchMedia) return 'estatico';
    if (w.matchMedia(PERFIS.estatico).matches) return 'estatico';
    if (w.matchMedia(PERFIS.completo).matches) return 'completo';
    return 'reduzido';
  }

  function lerOpts(el) {
    var bruto = el.getAttribute('data-rc-opts');
    if (!bruto) return {};
    try {
      var v = JSON.parse(bruto);
      return v && typeof v === 'object' ? v : {};
    } catch (err) {
      log('warn', 'data-rc-opts inválido (JSON) — usando {}', el);
      return {};
    }
  }

  function registrar(nome, fn) {
    if (typeof nome !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(nome) || typeof fn !== 'function') {
      log('warn', 'registrar(nome, fn): nome em kebab-case e fn função. Ignorado:', nome);
      return;
    }
    if (registros[nome]) {
      log('warn', '"' + nome + '" já registrado — segundo registro ignorado');
      return;
    }
    registros[nome] = fn;
    // Registro tardio (depois do boot): monta na hora.
    if (estado.booted && !estado.falhou) {
      montar(nome, fn);
      if (w.ScrollTrigger) w.ScrollTrigger.refresh();
    }
  }

  // No perfil estatico, from()/fromTo() viram no-op: nada nasce escondido (síntese §4.6 item 3).
  function gsapEstatico(gsap, nome) {
    var g = Object.create(gsap);
    var nada = function () {
      log('warn', 'snippet "' + nome + '" chamou from/fromTo no perfil estatico — ignorado');
      return gsap.set({}, {});
    };
    g.from = nada;
    g.fromTo = nada;
    return g;
  }

  function montar(nome, fn) {
    var gsap = w.gsap;
    var els = d.querySelectorAll('[data-rc~="' + nome + '"]');
    Array.prototype.forEach.call(els, function (el) {
      var opts = lerOpts(el);
      var mm = gsap.matchMedia();
      montagens.push(mm);
      mm.add(PERFIS, function (mmCtx) {
        var c = mmCtx.conditions;
        var perfil = c.estatico ? 'estatico' : c.completo ? 'completo' : c.reduzido ? 'reduzido' : null;
        if (!perfil) return undefined;
        var limpar;
        var quebrou = false;
        // Sub-contexto com escopo no elemento: seletores do snippet ("… .linha") ficam presos ao el,
        // e um erro no meio do snippet é revertido sem deixar nada no estado "from".
        var sub = gsap.context(function () {
          try {
            limpar = fn({
              el: el,
              perfil: perfil,
              gsap: perfil === 'estatico' ? gsapEstatico(gsap, nome) : gsap,
              ScrollTrigger: w.ScrollTrigger || null,
              SplitText: w.SplitText || null,
              Flip: w.Flip || null,
              Observer: w.Observer || null,
              lenis: RC.lenis,
              opts: opts,
            });
          } catch (err) {
            quebrou = true;
            log('error', 'snippet "' + nome + '" falhou no perfil ' + perfil + ' — revertido ao estado do CSS', err);
          }
        }, el);
        if (quebrou) {
          sub.revert();
          return undefined;
        }
        return function () {
          if (typeof limpar === 'function') {
            try { limpar(); } catch (err) { log('error', 'limpeza de "' + nome + '" falhou', err); }
          }
          sub.revert();
        };
      });
    });
  }

  function ligarLenis() {
    if (RC.lenis || !w.Lenis || w.matchMedia(PERFIS.estatico).matches) return;
    var lenis = new w.Lenis({ autoRaf: false, anchors: true }); // sem syncTouch: toque fica nativo
    if (w.ScrollTrigger) lenis.on('scroll', w.ScrollTrigger.update);
    tickLenis = function (t) { lenis.raf(t * 1000); };
    w.gsap.ticker.add(tickLenis, false, true); // once=false, prioritize=true (síntese §4.4)
    RC.lenis = lenis;
  }

  function desligarLenis() {
    if (!RC.lenis) return;
    if (tickLenis) w.gsap.ticker.remove(tickLenis);
    RC.lenis.destroy();
    RC.lenis = null;
    tickLenis = null;
  }

  // Trava de segurança do CTA (síntese §4.6, nuance do .from()): ~1,5s depois do boot,
  // todo [data-rc-cta] perde qualquer estilo inline que o GSAP tenha deixado.
  function armarTravaCTA() {
    clearTimeout(timerTrava);
    timerTrava = setTimeout(function () {
      Array.prototype.forEach.call(d.querySelectorAll('[data-rc-cta]'), function (el) {
        if (w.gsap) {
          w.gsap.killTweensOf(el);
          w.gsap.set(el, { clearProps: 'all' });
        } else {
          el.style.removeProperty('opacity');
          el.style.removeProperty('visibility');
          el.style.removeProperty('transform');
          el.style.removeProperty('clip-path');
        }
      });
    }, TRAVA_CTA_MS);
  }

  function falhar(motivo, err) {
    estado.falhou = true;
    estado.motivo = motivo;
    d.documentElement.classList.add('rc-sem-motion');
    montagens.splice(0).forEach(function (mm) { try { mm.revert(); } catch (e) { /* nada */ } });
    try { desligarLenis(); } catch (e) { /* nada */ }
    if (err) log('error', 'boot falhou (' + motivo + ') — página segue no estado final do CSS', err);
    else log('warn', 'motion desligado: ' + motivo + ' — página segue no estado final do CSS');
  }

  function boot() {
    try {
      if (!w.gsap || !w.matchMedia) {
        falhar('gsap ausente');
        return;
      }
      var gsap = w.gsap;
      ['ScrollTrigger', 'SplitText', 'Flip', 'Observer'].forEach(function (p) {
        if (w[p]) {
          gsap.registerPlugin(w[p]);
          estado.plugins.push(p);
        }
      });
      gsap.ticker.lagSmoothing(0);

      ligarLenis();
      // Reduced-motion ligado/desligado com a página aberta: Lenis acompanha.
      var mqEstatico = w.matchMedia(PERFIS.estatico);
      var aoMudar = function () {
        if (mqEstatico.matches) desligarLenis(); else ligarLenis();
        armarTravaCTA();
      };
      if (mqEstatico.addEventListener) mqEstatico.addEventListener('change', aoMudar);
      var mqCompleto = w.matchMedia(PERFIS.completo);
      if (mqCompleto.addEventListener) mqCompleto.addEventListener('change', armarTravaCTA);

      // Fila de quem chegou antes deste arquivo (ainda sem montar: booted é false aqui).
      filaPrevia.concat(RC.fila).forEach(function (par) { registrar(par[0], par[1]); });
      estado.booted = true;
      RC.fila = { push: function (par) { registrar(par[0], par[1]); } };
      // Monta tudo o que foi registrado antes do boot, na ordem de registro.
      Object.keys(registros).forEach(function (nome) { montar(nome, registros[nome]); });

      if (w.ScrollTrigger) {
        w.ScrollTrigger.refresh();
        if (d.readyState !== 'complete') w.addEventListener('load', function () { w.ScrollTrigger.refresh(); }, { once: true });
      }
    } catch (err) {
      falhar('erro no boot', err);
    } finally {
      armarTravaCTA();
      d.documentElement.classList.add('rc-pronto');
      var info = { perfil: perfilAtual(), lenis: !!RC.lenis, falhou: estado.falhou, motivo: estado.motivo, plugins: estado.plugins.slice() };
      resolverPronto(info);
      try { d.dispatchEvent(new CustomEvent('rc:pronto', { detail: info })); } catch (e) { /* nada */ }
    }
  }

  // Boot: DOMContentLoaded + fontes (com teto), para o SplitText medir a fonte certa (síntese T10).
  var dom = new Promise(function (r) {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', r, { once: true });
    else r();
  });
  dom
    .then(function () {
      var fontes = d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve();
      var teto = new Promise(function (r) { setTimeout(r, TETO_FONTES_MS); });
      return Promise.race([fontes, teto]);
    })
    .then(boot, boot);
})(window, document);
