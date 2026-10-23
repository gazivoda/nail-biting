// NEEDS NATIVE REVIEW (machine draft). Scope "photos", locale pt-BR.
import type { messages as en } from '../../scopes/photos';

export const messages: Record<keyof typeof en, string> = {
  // ── The diary screen ────────────────────────────────────────────────────────
  'diary.title': 'Diário de fotos',
  'diary.intro': 'Uma vez por semana, tire uma foto das suas mãos. Com o tempo, você pode colocar duas fotos lado a lado e ver como suas unhas estão agora em comparação com antes.',
  'diary.privacy.statement': 'As fotos ficam neste dispositivo. Elas são salvas somente neste navegador e nunca são enviadas, sincronizadas, exportadas nem mandadas por e-mail.',
  'diary.privacy.detail': 'Elas não fazem parte da exportação, da sincronização nem do e-mail semanal. Se você apagar os dados do site, trocar de navegador ou fechar uma janela privada, elas serão removidas.',
  'diary.notSaved': 'Este navegador não está guardando as fotos no disco agora, então elas vão sumir quando você fechar esta aba.',
  'diary.notMedical': 'Um diário de fotos é uma forma de olhar para trás, não um diagnóstico nem um tratamento.',
  'diary.takeFirst': 'Tire sua primeira foto',
  'diary.takeThisWeek': 'Tire a foto desta semana',
  'diary.due': 'Sua última foto foi {age}. Já é hora de uma nova.',
  'diary.cannotDecode': 'Este navegador não consegue mostrar as fotos salvas. Atualize-o ou abra o diário em uma versão recente do Chrome, Edge, Firefox ou Safari.',
  'diary.loading': 'Lendo suas fotos deste dispositivo',
  'diary.count': 'Suas fotos ({count})',
  'diary.size': '{size} neste dispositivo',
  'diary.photoLabel': 'Foto de {date}',
  'diary.keep': 'Manter',
  'diary.deleteOne.aria': 'Excluir a foto de {date}',
  'diary.deleteOne.question': 'Excluir esta foto?',
  'diary.compareHeading': 'Antes e depois',
  'diary.deleteNote': 'Ao excluir, a foto é removida deste navegador para sempre.',
  'diary.deleteAll': 'Excluir todas as fotos',
  'diary.deleteAll.question': '{count, plural, one {Excluir a foto?} other {Excluir todas as # fotos?}}',
  'diary.deleteAll.confirm': 'Excluir todas',
  'diary.deleteAll.keep': 'Manter minhas fotos',

  'status.saved': 'Foto salva neste dispositivo.',
  'status.savedTabOnly': 'Foto mantida somente nesta aba. Este navegador não a está salvando no disco.',
  'status.deleted': 'Foto excluída.',
  'status.deletedAll': 'Todas as {count} fotos foram excluídas.',

  // ── Before / after ──────────────────────────────────────────────────────────
  'compare.needTwo': 'Você precisa de duas fotos para comparar. Tire outra na semana que vem e aqui você poderá sobrepô-la à de hoje.',
  'compare.before': 'Antes',
  'compare.after': 'Depois',
  'compare.same': 'Os dois lados mostram a mesma foto. Escolha duas datas diferentes para ver a diferença.',
  'compare.photoBefore': 'Foto de {date} (antes)',
  'compare.photoAfter': 'Foto de {date} (depois)',
  'compare.badgeBefore': 'Antes, {date}',
  'compare.badgeAfter': 'Depois, {date}',
  'compare.sliderLabel': 'Mostrar a foto anterior',
  'compare.sliderValue': 'A foto anterior aparece em {percent} por cento da imagem',
  'compare.hint': 'Arraste a imagem ou o controle deslizante para alternar entre as duas.',

  // ── Taking a photo ──────────────────────────────────────────────────────────
  'capture.title': 'Tire uma foto das suas mãos',
  'capture.idle': 'A câmera só abre enquanto esta tela está aberta e desliga assim que a foto é tirada.',
  'capture.start': 'Iniciar a câmera',
  'capture.opening': 'Abrindo a câmera. Seu navegador pode pedir permissão.',
  'capture.photoLabel': 'A foto que você acabou de tirar',
  'capture.reviewNote': 'A câmera está desligada. Salve esta foto no seu diário neste dispositivo ou tire-a de novo.',
  'capture.saving': 'Salvando',
  'capture.save': 'Salvar foto',
  'capture.retake': 'Tirar de novo',
  'capture.discard': 'Descartar',
  'capture.saved': 'Salva no seu diário.',
  'capture.stopWatching': 'Parar o monitoramento e tentar de novo',
  'capture.previewLabel': 'Prévia ao vivo da câmera',
  'capture.guide': 'Coloque as mãos planas dentro da moldura, com as unhas voltadas para a câmera',
  'capture.mirrorNote': 'Mantenha seu rosto fora da imagem. A prévia é um espelho, e a foto é salva do jeito que você a vê.',
  'capture.countdown': 'Tirando a foto em {n}',
  'capture.waiting': 'Aguardando a imagem da câmera',
  'capture.cancelTimer': 'Cancelar o temporizador',
  'capture.takeIn': 'Tirar foto em {seconds} segundos',
  'capture.takeNow': 'Tirar agora',
  'capture.notReady': 'A câmera ainda não mostrou nenhuma imagem. Aguarde a prévia aparecer e tente novamente.',
  'capture.saveFailed': 'Não foi possível salvar a foto. Tente novamente.',
  'capture.hiddenNotice': 'A câmera foi desligada porque você saiu desta página. Ligue-a de novo quando quiser.',

  // ── Why the camera did not open ─────────────────────────────────────────────
  'problem.blocked.title': 'A câmera está bloqueada',
  'problem.blocked.detail': 'Seu navegador não permitiu o acesso à câmera. Permita-o para este site na barra de endereços ou nas configurações do navegador e tente novamente.',
  'problem.noCamera.title': 'Nenhuma câmera encontrada',
  'problem.noCamera.detail': 'Conecte uma webcam ou verifique se ela está ligada e não está bloqueada por uma chave de privacidade; depois, tente novamente.',
  'problem.watching.title': 'O monitoramento está usando a câmera',
  'problem.watching.detail': 'Sua câmera não abre uma segunda vez enquanto o monitoramento está ligado. Pare o monitoramento, tire a foto e depois inicie o monitoramento de novo na aba Monitorar.',
  'problem.busy.title': 'A câmera está ocupada',
  'problem.busy.detail': 'Outro aplicativo ou aba do navegador está usando a câmera. Feche-o e tente novamente.',
  'problem.insecure.title': 'A câmera precisa de uma página segura',
  'problem.insecure.detail': 'As câmeras só funcionam em páginas https (ou localhost). Abra o Stop Biting no endereço https e tente novamente.',
  'problem.unknown.title': 'A câmera não iniciou',
  'problem.unknown.detail': 'Algo deu errado ao abrir a câmera. Tente novamente ou recarregue a página.',
  'problem.frame.title': 'Não foi possível tirar a foto',

  // ── Storage limits ──────────────────────────────────────────────────────────
  'store.full': 'O diário comporta {max} fotos. Exclua algumas mais antigas para adicionar outras.',
  'store.writeFailed': 'Este navegador não salvou a foto. Libere espaço ou tente novamente.',

  // ── The weekly reminder strip (inside the app only) ─────────────────────────
  'reminder.aria': 'Lembrete do diário de fotos',
  'reminder.text': '<b>Hora da foto das mãos desta semana.</b> A última foi {age}.',
  'reminder.open': 'Abrir o diário de fotos',
  'reminder.snooze': 'Agora não',

  // ── Settings > Data > Photo diary ───────────────────────────────────────────
  'settings.saved': '{count, plural, =0 {Nenhuma foto salva.} one {# foto salva, {size} neste navegador.} other {# fotos salvas, {size} neste navegador.}}',
  'settings.deleteQuestion': '{count, plural, one {Excluir a foto deste navegador?} other {Excluir todas as # fotos deste navegador?}}',
  'settings.note': 'Limpar seu histórico, ou usar “Excluir tudo” nesta seção, não remove as fotos. Use este botão para elas.',
  'settings.allDeleted': 'Todas as fotos foram excluídas.',

  // ── Small helpers ───────────────────────────────────────────────────────────
  'age.ago': '{count, plural, =0 {hoje} one {há {count} dia} other {há {count} dias}}',
};
