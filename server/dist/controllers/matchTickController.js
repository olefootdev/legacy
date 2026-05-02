/**
 * Controller para tick de partida Quick Match (server-side anti-cheat).
 *
 * STUB: a implementação original importava lógica do GameSpirit do /src do
 * front, que não está disponível no container do Railway (root_dir=server
 * exclui o resto do repo). Front tem fallback local — ao receber 501, ele
 * roda o tick em runtime no cliente.
 *
 * Para reativar o anti-cheat server-side: portar GameSpirit/buildSpiritContext
 * para uma pasta compartilhada (ex: /shared/gamespirit) acessível tanto pelo
 * front quanto pelo server, OU mover o tick inteiro para Edge Function
 * Supabase (mesmo padrão do global-league-tick).
 */
export async function postMatchTick(c) {
    return c.json({
        ok: false,
        error: 'match-tick-stub',
        message: 'Server-side match tick não implementado nesta build. Front deve rodar fallback local.',
    }, 501);
}
//# sourceMappingURL=matchTickController.js.map