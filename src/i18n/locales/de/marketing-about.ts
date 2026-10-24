// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-about", locale de.
import type { messages as en } from '../../scopes/marketing-about';

export const messages: Record<keyof typeof en, string> = {
  'bc.about': 'Über uns',
  'hero.title': 'Über Stop <hl>Biting</hl>',
  'hero.lede': 'Entwickelt von jemandem, der an den Nägeln gekaut hat, für alle, die an den Nägeln kauen. Das ist der Grund, warum es diese App gibt.',

  'story.heading': 'Die Geschichte des Gründers',
  'story.p1': 'Ich bin Igor Gazivoda, Softwareentwickler. Über 20 Jahre lang habe ich an meinen Nägeln gekaut. Nicht gelegentlich: ständig, automatisch, ohne es zu merken, bis der Schaden schon da war.',
  'story.p2': 'Ich habe alles probiert: bitteren Nagellack, Erinnerungsbänder, reine Willenskraft. Alles scheiterte auf dieselbe Weise. Die Gewohnheit läuft automatisch ab. Sie passiert unterhalb der Schwelle des Bewusstseins. Bis ich merkte, dass meine Hand im Mund war, kaute ich schon seit 30 Sekunden.',
  'story.p3': 'Als ich die Forschung zum Habit-Reversal-Training (HRT) las, verstand ich, warum alles andere gescheitert war. Die Kernidee der HRT: Bewusstsein ist der Engpass, denn man kann eine Gewohnheit nicht unterbrechen, von der man nicht weiß, dass sie abläuft. Der Goldstandard unter den Behandlungen beginnt buchstäblich mit „Awareness-Training“, noch vor allem anderen.',
  'story.p4': 'Ich hatte eine Webcam. Ich konnte programmieren. Ich wusste, dass MediaPipe Handtracking direkt auf dem Gerät ausführen kann. Also baute ich den Bewusstseins-Baustein, den Teil der HRT, der allein am schwersten zu leisten ist.',

  'does.heading': 'Was Stop Biting macht',
  'does.p1': 'Stop Biting nutzt die Webcam deines Computers und Googles MediaPipe-Framework (zu WebAssembly kompiliert und komplett in deinem Browser ausgeführt), um zu erkennen, wenn sich deine Hand dem Mund nähert. Dann ertönt ein Alarm.',
  'does.p2': 'Dieser Alarm ist das externe Bewusstseinssignal, das die HRT-Forschung als wichtigsten Bestandteil der Behandlung ausweist. Er erwischt die Fälle, die Selbstbeobachtung übersieht. Die meisten passieren, ohne dass du es merkst.',
  'does.p3': 'Die App protokolliert außerdem jede Erkennung mit Zeitstempel, damit du deine tatsächliche Bisshäufigkeit siehst und nicht die geschätzte. Eine echte Zahl statt einer Vermutung macht die Gewohnheit zu etwas, woran du arbeiten kannst.',

  'privacy.heading': 'Datenschutz: das Unverhandelbare',
  'privacy.p1': 'Die App nutzt deine Webcam. Das erfordert Vertrauen. Ich habe sie so gebaut, dass sich dieses Vertrauen überprüfen lässt, statt nur versprochen zu werden.',
  'privacy.p2': 'Die gesamte Videoverarbeitung läuft in WebAssembly auf deinem Gerät. Es werden weder Video noch Einzelbilder noch Erkennungen übertragen. Du kannst deine Internetverbindung trennen, nachdem die App geladen ist, und sie funktioniert genauso. Du kannst das prüfen, indem du den Netzwerkverkehr beobachtest, während die App läuft.',
  'privacy.p3': '{sync, select, on {Dein Alarm- und Bissprotokoll wird in deinem Browser gespeichert und nur in dein Konto kopiert, wenn du die Synchronisierung einschaltest.} other {Dein Alarm- und Bissprotokoll wird in deinem Browser gespeichert.}} Die Seite zählt Seitenaufrufe mit Google Analytics; dabei wird nie etwas von deiner Kamera erfasst.',

  'tech.heading': 'Die Technik',
  'tech.p1': 'Das Erkennungsmodell basiert auf dem <link>Hand Landmarker von Google MediaPipe</link>, der 21 Handpunkte lokalisiert. Stop Biting führt ihn fünfmal pro Sekunde aus. Das Modell läuft in WebAssembly (einem abgeschotteten Binärformat, das alle modernen Browser unterstützen). Es hat also keinen Netzwerkzugriff und kann keine Dateien außerhalb der Browser-Sandbox lesen.',
  'tech.p2': 'Die Erkennung der Mundnähe vergleicht in jedem Bild die Koordinaten der Handpunkte mit denen der Gesichtspunkte. Liegt ein Handpunkt über einen längeren Zeitraum innerhalb des Schwellenwerts zum Mundbereich, löst der Alarm aus.',

  'site.heading': 'Wie diese Seite entsteht',
  'site.p1': 'Jeder Artikel, jeder Ratgeber und jeder Vergleich hier stammt von mir. Ich bin Entwickler, kein Kliniker, und die <link>Seite zu redaktionellen Richtlinien und Korrekturen</link> sagt genau, was das für das Gelesene bedeutet: wie Aussagen belegt werden, wie alles geprüft wird, was ich über ein Konkurrenzprodukt sage, und wie du mir mitteilst, wenn etwas auf dieser Seite falsch ist.',
};
