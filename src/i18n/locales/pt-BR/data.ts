// NEEDS NATIVE REVIEW (machine draft). Scope "data", locale pt-BR.
import type { messages as en } from '../../scopes/data';

export const messages: Record<keyof typeof en, string> = {
  // ── Configurações > Dados: o cartão ────────────────────────────────────────
  'card.title': 'Dados',

  // ── Exportar ───────────────────────────────────────────────────────────────
  'export.label': 'Exportar seu histórico',
  'export.description': 'O JSON restaura tudo, inclusive as datas da sua sequência. O CSV abre em uma planilha. Ambos são salvos no seu computador; nada é enviado.',
  'export.json': 'Exportar JSON',
  'export.csv': 'Exportar CSV',
  'export.savedJson': '{count, plural, one {# evento foi salvo} other {# eventos foram salvos}} em um arquivo a partir do qual você pode restaurar.',
  'export.savedCsv': '{count, plural, one {# linha foi salva} other {# linhas foram salvas}} para uma planilha.',

  // ── Restaurar (importar) ───────────────────────────────────────────────────
  'restore.label': 'Restaurar de um arquivo',
  'restore.description': 'Escolha um arquivo JSON que você exportou antes. Você vê primeiro o que ele mudaria. Eventos que você já tem não são duplicados, e os mais recentes daqui nunca são sobrescritos.',
  'restore.fileLabel': 'Escolha um arquivo de histórico para restaurar',
  'restore.chooseFile': 'Escolher arquivo',
  'restore.ok': 'OK',

  'preview.aria': 'Prévia da importação',
  'preview.title': '{fileName}: {total, plural, one {# entrada} other {# entradas}}',
  'preview.titleExported': '{fileName}: {total, plural, one {# entrada} other {# entradas}}, exportado em {when}',
  'preview.restoresWhole': 'Este dispositivo ainda não tem histórico, então isto restaura tudo do arquivo, inclusive as datas da sua sequência.',
  'preview.added': '{count, plural, one {# novo evento será adicionado} other {# novos eventos serão adicionados}}',
  'preview.addedRange': '{count, plural, one {# novo evento será adicionado} other {# novos eventos serão adicionados}} (de {from} a {to})',
  'preview.updated': '{count, plural, one {# evento daqui será substituído por uma versão mais recente do arquivo} other {# eventos daqui serão substituídos por uma versão mais recente do arquivo}}',
  'preview.deletions': '{count, plural, one {# registro de exclusão do arquivo será aplicado} other {# registros de exclusão do arquivo serão aplicados}}',
  'preview.unchanged': '{count, plural, one {# já está aqui e não mudou} other {# já estão aqui e não mudaram}}',
  'preview.keptNewer': '{count, plural, one {# evento daqui é mais recente que a versão do arquivo e continua como está} other {# eventos daqui são mais recentes que a versão do arquivo e continuam como estão}}',
  'preview.duplicates': '{count, plural, one {# aparece duas vezes no arquivo (contado uma vez)} other {# aparecem duas vezes no arquivo (contados uma vez)}}',
  'preview.invalid': '{count, plural, one {# entrada não é válida e será ignorada} other {# entradas não são válidas e serão ignoradas}}',
  'preview.exceedsLimit': 'O app guarda os {max, number} eventos mais recentes, então os mais antigos deste arquivo ficarão de fora.',
  'preview.sampleHeading': 'Eventos mais recentes sendo adicionados',
  'preview.sampleLine': '{when} · {source, select, alarm {alarme} other {registrado manualmente}} · {behavior}',
  'preview.noop': 'Não há nada novo neste arquivo. Seu histórico continua exatamente como está.',
  'preview.import': 'Importar',

  'behavior.nail_biting': 'roer as unhas',
  'behavior.cuticle_skin_biting': 'roer as cutículas e a pele',
  'behavior.nose_picking': 'cutucar o nariz',
  'behavior.eye_area_pulling': 'arrancar cílios e sobrancelhas',
  'behavior.face_skin_picking': 'cutucar a pele do rosto',
  'behavior.hair_pulling': 'arrancar cabelo',

  // ── Depois de importar ─────────────────────────────────────────────────────
  'done.added': 'Pronto. Adicionados: {added, plural, one {# evento} other {# eventos}}.',
  'done.addedUpdated': 'Pronto. Adicionados: {added, plural, one {# evento} other {# eventos}}, atualizados: {updated, number}.',
  'done.addedDeletions': 'Pronto. Adicionados: {added, plural, one {# evento} other {# eventos}}, aplicadas: {deletions, plural, one {# exclusão} other {# exclusões}}.',
  'done.addedUpdatedDeletions': 'Pronto. Adicionados: {added, plural, one {# evento} other {# eventos}}, atualizados: {updated, number}, aplicadas: {deletions, plural, one {# exclusão} other {# exclusões}}.',
  'done.keptNewer': '{count, plural, one {# evento mais recente foi mantido como estava.} other {# eventos mais recentes foram mantidos como estavam.}}',
  'done.andMore': 'e mais {count, number}',

  // ── Por que um arquivo foi recusado ────────────────────────────────────────
  'import.tooBig': 'Esse arquivo é maior que {mb} MB. Uma exportação de histórico é bem menor, então provavelmente não é uma.',
  'import.notJson': 'Esse arquivo não é um JSON válido. Escolha um arquivo que você exportou do Stop Biting.',
  'import.notHistory': 'Esse arquivo não parece uma exportação de histórico do Stop Biting.',
  'import.tooMany': 'Esse arquivo tem mais de {max, number} entradas.',
  'import.noEvents': 'Esse arquivo não tem nenhum evento.',
  'import.noneValid': 'Nenhuma das entradas desse arquivo é um evento válido.',
  'import.unreadable': 'Não foi possível ler esse arquivo.',

  // ── Por que uma exclusão falhou ────────────────────────────────────────────
  'failure.network': 'Não foi possível conectar ao servidor. Nada foi excluído. Verifique sua conexão e tente de novo.',
  'failure.signedOut': 'Você saiu da conta. Entre de novo e tente mais uma vez.',
  'failure.rateLimited': 'Muitas solicitações. Aguarde um minuto e tente de novo.',
  'failure.server': 'O servidor não conseguiu excluir. Nada foi excluído. Tente de novo daqui a pouco.',

  // ── Excluir dados sincronizados ────────────────────────────────────────────
  'wipe.label': 'Excluir dados sincronizados',
  'wipe.description': 'Remove a cópia do seu histórico guardada na sua conta. O histórico deste dispositivo permanece e a sincronização é desativada.',
  'wipe.checking': 'Verificando…',
  'wipe.confirmAria': 'Confirmar a exclusão dos dados sincronizados',
  'wipe.confirmSome': 'Isto exclui permanentemente {count, plural, one {# evento sincronizado} other {# eventos sincronizados}} da sua conta. Os outros dispositivos vão parar de sincronizar. Não dá para desfazer.',
  'wipe.confirmNone': 'Isto apaga permanentemente o histórico guardado na sua conta. Os outros dispositivos vão parar de sincronizar. Não dá para desfazer.',
  'wipe.yes': 'Sim, excluir dados sincronizados',
  'wipe.deleting': 'Excluindo…',
  'wipe.doneSome': '{count, plural, one {# evento sincronizado foi excluído} other {# eventos sincronizados foram excluídos}} da sua conta. A sincronização está desativada. O histórico deste dispositivo não foi alterado.',
  'wipe.doneNone': 'O histórico guardado na sua conta foi apagado. A sincronização está desativada. O histórico deste dispositivo não foi alterado.',

  // ── Excluir tudo ───────────────────────────────────────────────────────────
  'all.label': 'Excluir tudo',
  'all.description': 'Apaga seu histórico, sua sequência, os motivos das mordidas e as configurações neste dispositivo.',
  'all.confirmAria': 'Confirmar a exclusão de tudo',
  'all.confirm': 'Isto apaga seu histórico, sua sequência, os motivos das mordidas e todas as configurações neste dispositivo. Não dá para desfazer.',
  'all.alsoSynced': 'Excluir também a cópia sincronizada com a minha conta. Se você deixar desativado, a cópia permanece e a sincronização é desativada neste dispositivo.',
  'all.yes': 'Sim, excluir tudo',
  'all.deleting': 'Excluindo…',
  'all.done': 'Tudo neste dispositivo foi apagado.',

  // ── Configurações > Conta e sincronização ──────────────────────────────────
  'sync.title': 'Conta e sincronização',
  'sync.dismiss': 'Dispensar',
  'sync.toggle': 'Sincronizar meu histórico entre dispositivos',
  'sync.toggleDescription': 'Seu histórico é sincronizado com sua conta quando isto está ativado. Os dados da câmera nunca saem do seu dispositivo.',
  'sync.signInToUse': 'Entre na sua conta para usar a sincronização.',
  'sync.whatSyncs': 'O que é sincronizado: de cada entrada, a hora, o tipo, o motivo da mordida que você escolheu, qual mão (se for conhecida) e se você concluiu uma resposta concorrente. Nunca vídeo, fotos, pontos de rastreamento do rosto ou das mãos, nem o seu diário de fotos. Fica desativada até você ativar, e você pode desativar ou excluir a cópia sincronizada a qualquer momento (veja Dados).',
  'sync.statusLabel': 'Status',
  'sync.syncNow': 'Sincronizar agora',
  'sync.deviceLabel': 'Este dispositivo',
  'sync.deviceDescription': 'Só você vê este nome. Ele fica neste dispositivo.',
  'sync.deviceNameLabel': 'Nome deste dispositivo',

  // ── O nome padrão deste dispositivo ────────────────────────────────────────
  'device.browserOnOs': '{browser} no {os}',
  'device.app': 'App Stop Biting',
  'device.fallback': 'Este dispositivo',

  // ── As palavras do que a sincronização está fazendo ────────────────────────
  'status.syncing': 'Sincronizando…',
  'status.offline.headline': 'Você está offline.',
  'status.offline.detail': 'Tudo está salvo neste dispositivo e será sincronizado quando você voltar a ficar online.',
  'status.offline.detailPending': 'Tudo está salvo neste dispositivo e será sincronizado quando você voltar a ficar online. {pending, plural, one {# alteração está aguardando} other {# alterações estão aguardando}} envio.',
  'status.backoff.headline': 'Não foi possível conectar ao servidor.',
  'status.backoff.detailAt': 'Seu histórico está seguro neste dispositivo. Nova tentativa {when}.',
  'status.backoff.detailSoon': 'Seu histórico está seguro neste dispositivo. Nova tentativa em breve.',
  'status.signedOut.headline': 'Você saiu da conta.',
  'status.signedOut.detail': 'Entre de novo para continuar sincronizando. Seu histórico neste dispositivo não foi alterado.',
  'status.unavailable.headline': 'A sincronização não está disponível no momento.',
  'status.unavailable.detail': 'Seu histórico está seguro neste dispositivo. Ela tentará de novo mais tarde.',
  'status.rejected.headline': 'O servidor não aceitou algumas alterações.',
  'status.rejected.detail': 'Nada é perdido neste dispositivo. Tente Sincronizar agora.',
  'status.quota.headline': 'Seu histórico sincronizado está cheio.',
  'status.quota.detail': 'Exporte uma cópia em Dados, abaixo, e depois exclua a cópia sincronizada para começar do zero.',
  'status.serverReset.headline': 'Os dados sincronizados foram excluídos, então a sincronização está desativada.',
  'status.serverReset.detail': 'Seu histórico neste dispositivo não foi alterado.',
  'status.firstSync': 'Aguardando a primeira sincronização.',
  'status.lastSynced': 'Última sincronização {when}.',
  'status.waiting': '{pending, plural, one {# alteração está aguardando} other {# alterações estão aguardando}} envio.',
  'notice.serverReset.headline': 'Seus dados sincronizados foram excluídos de outro dispositivo, então a sincronização está desativada aqui.',
  'notice.serverReset.detail': 'Seu histórico neste dispositivo não foi alterado. Ative a sincronização para enviá-lo de novo.',
};
