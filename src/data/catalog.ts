import { SYMBOLS, type Actor, type Category, type CommandEntry, type GameEvent, type TimelineBeat } from './types';

/**
 * SECRET START's complete, local, authored catalogue.
 * Each row is an individual script: title | cast | prop | palette | action~caption …
 * Scripts intentionally share a small set of visual verbs, but never their situations
 * or punchlines. No network, random generation, or paid service is used at runtime.
 */
type Palette = 'midnight' | 'ocean' | 'forest' | 'rose' | 'amber' | 'void';
interface Seed {
  title: string;
  actor: Actor;
  prop: Actor;
  palette: Palette;
  beats: { action: string; text: string }[];
  mechanic?: string;
}

function readScripts(source: string): Seed[] {
  return source.trim().split(/\r?\n/).filter(Boolean).map(row => {
    const [title, actor, prop, palette, ...script] = row.split('|');
    return {
      title,
      actor: actor as Actor,
      prop: prop as Actor,
      palette: palette as Palette,
      beats: script.map(part => {
        const separator = part.indexOf('~');
        return { action: part.slice(0, separator), text: part.slice(separator + 1) };
      }),
    };
  });
}

const remixSeeds = readScripts(`
宇宙までひとっ飛び|hero|moon|midnight|rise~月に会いたくて、主人公が空へ上がった。|orbit~ここでは小さな月が、いくつも周りを回っている。|wave~月たちへごあいさつ。宇宙旅行、まずは成功。
はみだす大きさ|hero|title|amber|grow~看板の横で、主人公の体が大きくなり始めた。|shake~止まろうとしても、大きな体がぶるぶる揺れる。|shrink~やっと元の大きさに。看板の前にも立てるね。
猫の月見ジャンプ|cat|moon|midnight|enter~猫が月を見つけて、そっと近づいた。|jump~さわれると思って、大きくジャンプ。|sleep~届かなかったので、月のそばでお昼寝にした。
鳥の荷物運び|bird|box|ocean|enter~鳥の前に、運びたい箱がある。|pull~引いてみたけど、ひと箱でも重い。|train~列車なら一度に運べる。鳥の箱便、出発！
植木の背比べ|plant|hero|forest|enter~主人公の隣へ、植木がやってきた。|grow~もっとよく見えるように、ぐんぐん伸びる。|wave~大きくなった葉でごあいさつ。もう見落とされない。
箱運びの休憩|robot|box|amber|walk~ロボットが、遠くに置かれた箱へ歩いていく。|pull~重い箱を引き寄せて、今日の仕事はおしまい。|sleep~運んだ箱のそばで、ロボットも充電休憩。
先に驚いたのは|ghost|hero|ocean|blackout~暗い場所で、おばけが主人公を待っている。|reveal~明かりがついた。主人公はすぐ隣にいた！|jump~近すぎて、待っていたおばけの方が飛び上がった。
道をゆずる練習|hero|ghost|rose|walk~主人公がおばけの方へ歩いていく。|chase~おばけも同じ方へ動くので、なかなか並べない。|swap~思い切って場所を交換。今度はお互いに道をゆずれた。
空飛ぶ魚のレッスン|fish|bird|ocean|enter~空を飛びたい魚が、鳥のところへ来た。|float~鳥のまねをしたら、魚の体もふわりと浮いた。|dance~飛ぶより先に、二人で空中ダンスを覚えた。
植木のための台|box|plant|forest|shake~小さな植木の隣で、箱が置き場所に悩んでいる。|build~植木を重ねて、小さな緑の段を作った。|celebrate~ひと鉢ずつがよく見える。植木の展示、完成！
寝かせてくれない星|robot|star|midnight|sleep~ロボットが星のそばで、休もうとしている。|rain~ところが、上からも星が次々に降ってきた。|reveal~目を覚ました。今夜は先に星を片づけよう。
猫の王冠当番|cat|crown|rose|enter~王冠を見張るために、猫がやってきた。|spotlight~明かりの下で、猫はきりっと座っている。|sleep~見張りは一分で終了。王冠より昼寝が大事だった。
魚にも見せたい|hero|fish|ocean|mirror~主人公が鏡をのぞくと、同じ姿が返ってきた。|jump~魚にも見てもらおうと、大きくジャンプ。|wave~魚の方へ手を振る。次は君の番だよ。
ケーキの展示係|robot|cake|rose|build~ロボットがケーキを並べ、低い台を作る。|stack~今度は上にも積んで、いちばん上まで飾った。|celebrate~大きなケーキの山が完成。倒さずに展示できた！
魚を釣ったあとの話|hero|fish|ocean|fish~主人公が糸を垂らすと、魚が寄ってきた。|pull~魚をそっと手元へ引き寄せる。|wave~近くで会えたのでごあいさつ。今日は逃がしてあげよう。
ロボットの植木選び|robot|plant|forest|type~ロボットが端末で、植木のマークを選んだ。|build~届いた植木を、一列ずつ並べていく。|sleep~緑がいっぱいになった場所で、ひと休みすることにした。
月とケーキの背比べ|moon|cake|amber|enter~月がケーキの大きさを確かめに来た。|grow~負けたくなくて、月がどんどん大きくなる。|shrink~でも小さい方が近くで見られる。元の大きさに戻った。
凍ったスライム|slime|box|ocean|jump~スライムが、箱を元気に飛び越えた。|freeze~着地したところで、体が氷に閉じ込められた！|reveal~氷が消えた。次は冷たい場所をよけて跳ぼう。
鳥の小さな公演|bird|star|forest|spotlight~星のお客さんの前で、鳥に明かりが当たる。|dance~鳥が踊ると、星もいっしょに揺れ始めた。|celebrate~初めての公演は大成功。お客さんも楽しんでくれた。
鳥がいっぱい|box|bird|rose|shake~箱の隣で、鳥が落ち着かずに揺れている。|explode~鳥たちが一斉に、箱の周りへ飛び出した。|wave~箱があいさつすると、鳥たちも近くへ戻ってきた。
鏡よりもおやつ|hero|cake|rose|mirror~鏡の前で、主人公が身だしなみを確かめる。|reveal~鏡が消えると、隣にはケーキが置いてあった。|dance~準備はもう十分。おやつの前で喜びのダンス。
箱の山を越えたい|hero|box|void|enter~進みたい先に、箱が置かれていた。|stack~箱が上へ上へと積み上がって、道をふさぐ。|jump~主人公は大きく跳んで、箱の山を越えていった。
植木のお引っ越し|plant|box|forest|pull~植木が、自分の隣へ箱を引き寄せる。|walk~箱の周りを歩いて、新しい場所を確かめた。|sleep~ここなら落ち着ける。箱を目印に、お引っ越し終了。
猫と逃げる星|cat|star|midnight|pull~猫が、気になる星を手元へ引き寄せた。|chase~星がすいっと逃げるので、猫も後を追う。|dance~追うのをやめて並んだら、一緒に遊べた。
植木のかくれんぼ|ghost|plant|ocean|enter~おばけが植木を見つけて、かくれんぼを始めた。|hide~葉っぱの後ろへ隠れる。白い体は見えていないかな。|reveal~もういいよ。植木の横から、おばけが顔を出した。
月の引き寄せ係|robot|moon|midnight|enter~遠くの月を見つけて、ロボットが近づいた。|pull~ゆっくり引いて、月を手元へ呼び寄せる。|orbit~月たちが周りを回り始めた。引き寄せすぎたかな。
猫用の箱タワー|cat|box|amber|stack~猫のために、箱が縦に積み上がった。|jump~猫はてっぺんを目指して、勢いよく跳ぶ。|shake~着いたのは下。体の揺れを落ち着けて、低い箱から練習しよう。
高いところが好き|slime|plant|ocean|rise~スライムが、植木より高いところまで上がる。|bounce~高く跳ねたら、葉っぱの上までよく見えた。|wave~見晴らしに満足。下の植木へ手を振った。
月の周回テスト|star|moon|midnight|enter~星が月のそばへ、様子を見に来た。|orbit~月たちはぶつからずに、星の周りを回る。|celebrate~一周できた！ 今夜の空の準備はこれで完了。
ケーキが釣れた|hero|cake|rose|fish~何か引っかかった。主人公が糸を見つめている。|pull~引き寄せたのは、魚ではなくケーキだった。|celebrate~今日は釣りの帰りに、おやつまでついてきた！
箱の近道|hero|box|amber|portal~箱の向こうへ行きたくて、二つの光をくぐった。|pull~着いた先で、箱を自分の方へ引き寄せる。|wave~近道と荷物運びを、一度に済ませられた。
星になりたいスライム|slime|star|ocean|shake~スライムが星を見ながら、体の形を変えようとする。|jump~勢いをつけて、空へ向かってひと跳び。|transform~着いたときには星の形。あこがれがかなった！
植木の呼び出し|plant|robot|forest|type~植木が端末で、ロボットの印を選んだ。|wave~隣に来たロボットへ、葉っぱを振って知らせる。|dance~ちゃんと気づいてもらえた。次は踊りであいさつ。
ふわふわの友だち|ghost|slime|ocean|enter~おばけが、地面にいるスライムを誘いに来た。|float~二人とも浮かんだ。これなら同じ高さで遊べる。|dance~上手に着地する前に、空中の踊りが始まった。
植木に負けたくない|hero|plant|forest|pull~主人公が植木を近くに置いて、背を比べる。|grow~一番になりたくて、体を大きくした。|shrink~大きすぎて比べられない。いつもの背丈でいいね。
回りすぎた箱|box|moon|rose|enter~月に見せたくて、箱が回転の準備をする。|spin~勢いよく、くるりと一回転！|shake~止まったあともふらふら。次はゆっくり回ろう。
星のそばのお昼寝|hero|star|midnight|pull~まぶしい星を、主人公が近くへ引き寄せる。|orbit~星は落ち着かずに、周りを回り始めた。|sleep~動きを眺めていたら、先に主人公が眠ってしまった。
鳥の植木見回り|bird|plant|forest|enter~鳥が、今日も植木の様子を見に来た。|walk~葉っぱの前を歩いて、倒れていないか確かめる。|wave~今日も元気そう。鳥はあいさつして見回りを終えた。
看板のサイズ直し|title|cat|amber|grow~猫に見せるため、看板が大きくなった。|shake~大きすぎてふらつく。猫の場所まで揺れている。|shrink~元に戻せば安定した。近くで見てもらえばいい。
月を越える近道|hero|moon|ocean|walk~主人公が月のところまで、歩いてきた。|portal~遠回りの代わりに、二つの光をくぐる。|wave~反対側へ到着。月へ手を振って、近道成功。
ロボットの小さな庭|robot|plant|forest|enter~ロボットが、ひと鉢の植木を見つけた。|stack~もっとよく見えるように、植木を段々に並べる。|spotlight~明かりも当てた。小さな庭の展示が始まる。
星の箱当番|star|box|amber|fall~箱の隣へ、星が落ちてきた。|hide~誰かに見つかる前に、箱の後ろへ隠れる。|reveal~でもお客さんは来なかった。今日は星が箱を見守ろう。
魚と植木のダンス|fish|plant|ocean|enter~魚が、じっとしている植木を誘いに来た。|dance~魚が揺れると、植木もいっしょに揺れた。|wave~短いダンスのあと、二人でまた明日とあいさつ。
看板に変身|slime|title|void|enter~スライムが、四角い看板の形をじっと見る。|shake~丸い体を揺らして、角を作ろうとがんばった。|transform~とうとう看板の形に。今日は動かない遊びにしよう。
おばけの鏡チェック|ghost|cat|midnight|mirror~おばけが鏡をのぞく。ちゃんと姿が映っている。|reveal~鏡を片づけると、猫が隣で待っていた。|hide~見られるのは少し恥ずかしい。猫の後ろへ隠れた。
月の星集め|moon|star|midnight|pull~月が、離れていた星を引き寄せる。|rain~呼びかけが届きすぎて、星がたくさん降ってきた。|orbit~みんなで月を囲んだ。今夜はにぎやかな空になる。
ケーキが主役の日|cake|hero|rose|enter~主人公の前へ、ケーキが堂々とやってきた。|spotlight~明かりを受けて、今日の主役をアピール。|celebrate~食べる前に、まずはケーキをお祝いしよう。
箱にかくれたつもり|hero|box|ocean|grow~箱へ隠れる前に、主人公が大きくなってしまった。|shrink~これでは丸見え。あわてて元の大きさへ戻る。|hide~今度こそ箱の後ろへ。かくれんぼの準備ができた。
鳥の王冠配達|bird|crown|forest|pull~鳥が王冠を引いて、近くへ運んできた。|train~残りの王冠も、列車に積んで運ぶことにした。|celebrate~まとめて到着！ 鳥の配達便は今日も時間どおり。
猫を起こさないで|robot|cat|rose|enter~ロボットが、猫の様子を見に来た。|freeze~動くと起こしそうなので、氷のように固まった。|reveal~氷が消えても猫はここにいる。今度は普通に待とう。
歩く植木の見本|plant|hero|forest|walk~植木が主人公の前を、すたすた歩く。|jump~続けてジャンプ。鉢ごとでも動けるところを見せた。|wave~歩けないと思っていた？ 葉っぱを振って得意顔。
魚に追いつく方法|hero|fish|void|spotlight~明かりの下に立つと、隣に魚が見えた。|chase~つかまえようと追うけれど、魚も先へ進む。|float~歩くのをやめて浮かんだら、同じ高さで並べた。
箱の星まつり|box|star|rose|shake~箱の隣で、小さな星が揺れている。|rain~そこへ仲間の星が、次々に降ってきた。|celebrate~みんな集まった。箱を囲んで、星まつりの始まり！
猫が看板を選ぶ|cat|title|amber|walk~猫が、看板の置かれたところへ歩いてきた。|pull~よく見える場所まで、看板を引き寄せる。|sleep~確認は終わり。この看板の横を昼寝の場所に決めた。
魚の星拾い|fish|star|ocean|fall~魚が降りてくると、すぐそばに星があった。|pull~流れていかないように、星を引き寄せる。|wave~星の近くでひれを振る。拾ったものは、新しい友だち。
おばけの箱列車|ghost|box|void|enter~おばけが箱のところへ、迎えにやってきた。|train~箱を乗せた列車が出発。おばけは先頭に立つ。|sleep~運び終えたらひと休み。今夜の配達はこれでおしまい。
おやつの呼び出し|hero|cake|amber|type~主人公が端末で、ケーキのマークを選ぶ。|reveal~隣には、頼んだケーキが置かれていた。|jump~ちゃんと届いた！ 待っていた主人公が跳び上がる。
箱の中に隠れる前に|hero|box|forest|spin~箱へ隠れる前に、主人公が向きを変える。|shake~どちらから入ろう。迷っているうちに体が揺れた。|hide~ようやく箱の後ろへ。まずは落ち着いて隠れよう。
植木の隣の王冠|crown|plant|rose|walk~植木の隣に飾られるため、王冠がやってきた。|spotlight~明かりの下で、自分の置き場所を確かめる。|wave~ここでよさそう。植木へ小さくあいさつした。
弾む箱とスライム|slime|box|ocean|enter~スライムが、動かない箱を遊びに誘う。|bounce~自分が跳ねると、箱も少しずつ弾み始めた。|dance~動きがそろったところで、二人の踊りが始まった。
鳥と旅人の合図|bird|hero|forest|rise~鳥が上へ飛び、主人公に見える高さへ出た。|wave~羽を振って、ここにいるよと知らせる。|fall~ちゃんと気づいてもらえたので、隣へ降りてきた。
月の箱片づけ|moon|box|midnight|pull~月が、離れた箱を自分の方へ引いた。|stack~集まった箱を、上へ順番に積んでいく。|celebrate~箱がまとまった。これで月の周りもすっきりした。
ロボットと大きな植木|robot|plant|ocean|pull~植木が遠いので、ロボットが近くへ引く。|grow~葉の上まで見ようと、自分の体を大きくした。|shrink~倒れていないと確認できたので、元の大きさへ戻った。
ケーキの星飾り|cake|star|rose|enter~ケーキの前に、小さな星が待っている。|orbit~星たちがケーキを囲んで、くるくる回り始めた。|spotlight~明かりを当てれば完成。今夜だけのケーキ展示。
留守番を交代|box|cat|amber|enter~猫のいるところへ、留守番の箱がやってきた。|swap~二人で場所を交換。今度は箱が表に立つ。|wave~猫は休んでいいよ。箱が見送りのあいさつをした。
月と眠る夜|hero|moon|midnight|enter~主人公が、月の見える場所へやってきた。|float~月と同じように浮かんで、夜の景色を眺める。|sleep~満足したので、そのまま月のそばで眠りについた。
鳥を招く植木|plant|bird|forest|shake~植木が葉を揺らして、鳥へ合図を送る。|pull~遠くの鳥を、そっと自分の近くへ呼び寄せた。|wave~これなら声を張らずにすむ。隣で静かにごあいさつ。
ロボットの魚相談|robot|fish|ocean|type~ロボットが端末で、魚のマークを確かめる。|fish~実際の魚に会おうと、糸を垂らしてみた。|wave~寄ってきてくれた。調べるより、会う方が早かったね。
おばけと順番交代|hero|ghost|void|pull~主人公が、おばけを近くへ呼び寄せる。|wave~手を振って、次は君が前だよと知らせた。|swap~場所を交換。二人とも一度ずつ、先頭に立てた。
星の月見列車|star|moon|midnight|train~星が先頭に立って、月を乗せた列車が走る。|wave~到着したので、星が月たちへあいさつをする。|sleep~みんなを送り届けた星は、ここでひと眠り。
猫の回転見本|cat|bird|forest|enter~鳥に見せたくて、猫が真ん中へ出てきた。|spin~しっぽを追いかけるように、一回転。|dance~鳥もつられて動き出した。回転の次は二人でダンス。
星を見失った|hero|star|void|blackout~急に暗くなって、主人公は星を見失った。|reveal~明るくなると、星はすぐ隣にいた。|pull~もう迷わないように、少しだけ近くへ引き寄せた。
王冠を越える練習|hero|crown|amber|enter~主人公の前に、王冠が置かれている。|jump~踏まないように、ひと跳びで飛び越えた。|celebrate~ぶつからずに着地。大切な王冠も無事だった。
おばけの星明かり|ghost|star|ocean|blackout~暗くなると、おばけの姿まで見えにくくなった。|reveal~星の隣へ明かりが戻り、おばけも見える。|spotlight~今度はここに明かりを当てよう。かくれんぼはもうおしまい。
鳥の箱点検|bird|box|ocean|enter~鳥が、運ぶ前の箱を見に来た。|jump~上を飛び越して、反対側まで確かめる。|pull~問題なし。引き寄せて、配達の準備ができた。
植木の道案内|plant|hero|forest|enter~主人公のいるところへ、植木が迎えに来た。|walk~こっちだよ。植木が鉢ごと歩いて見本を見せる。|wave~少し進んで振り返り、主人公に手招きした。
スライムの星見物|slime|star|ocean|grow~星をよく見たくて、スライムが大きくなった。|mirror~鏡で自分を見たら、星より自分の方が目立っている。|shrink~いつもの大きさに戻ろう。今夜の主役は星だから。
月を待つ主人公|hero|moon|midnight|walk~主人公が、月の隣まで歩いてきた。|freeze~待っているうちに、寒くて氷に包まれてしまった。|reveal~氷が消えてひと安心。今度は長く待ちすぎないように。
ロボットの植木便|robot|plant|forest|pull~ロボットが、届ける植木を手元へ集める。|train~列車に積んで、まとめて出発。|wave~配達完了。植木の前で、またねと手を振った。
魚の看板チェック|fish|title|ocean|walk~魚が看板の前まで、ゆっくり進んできた。|mirror~鏡に映った自分を見て、向きが合っているか確かめる。|reveal~鏡を片づけた。今度は看板と並んで、見本の魚になろう。
小さくなる王冠|crown|cat|rose|grow~猫より目立とうと、王冠が大きくなった。|spin~大きな姿で回るけれど、少し邪魔そうだ。|shrink~元の大きさへ戻った。猫の隣なら、これくらいがいい。
月と魚のすれ違い|fish|moon|ocean|float~魚が浮かぶと、月と同じ高さになった。|swap~進む方向が重なったので、二人で場所を交換する。|wave~無事にすれ違えた。ひれを振って、また今夜。
猫の植木チェック|cat|plant|forest|enter~猫が、新しい植木を調べに来た。|hide~葉っぱの後ろへ回って、隠れ具合を確かめる。|reveal~顔を出した。この植木は、かくれんぼにも使えそう。
箱を照らす星|star|box|amber|blackout~暗くなって、星も箱の場所がわからない。|reveal~明かりが戻ると、箱は目の前にあった。|spotlight~次に迷わないように、星がそばで光る番になった。
ケーキを守るスライム|slime|cake|rose|enter~スライムが、ケーキの見張りに来た。|grow~大きくなって、近づくものを止めるつもり。|sleep~でも見張りは眠たくなる。大きな番人の昼休み。
鳥になったロボット|robot|bird|forest|enter~ロボットが、鳥の動きをじっと見ている。|jump~まずは羽の代わりに、足で跳んでみた。|transform~ついに鳥の姿へ。これなら一緒に飛べそうだ。
箱の行進練習|box|robot|amber|walk~箱が、ロボットの前まで歩いてくる。|freeze~合図に合わせて停止。止まりすぎて氷に包まれた。|reveal~氷を解いて練習再開。次はそこまで固まらなくていい。
星のサプライズ|hero|star|midnight|hide~主人公が星の後ろに隠れて、出番を待つ。|reveal~いまだ！ 星の横から姿を見せた。|celebrate~小さな登場でも、お祝いは大きくしよう。
猫とケーキの距離|cat|cake|rose|chase~ケーキが動くので、猫が後を追いかける。|pull~逃げないように、手元へ引き寄せた。|sleep~安心したら眠くなった。おやつは起きてからにしよう。
看板の前で待ち合わせ|hero|title|amber|enter~主人公が、待ち合わせの看板へやってきた。|walk~よく見える場所を探して、看板の前へ進む。|wave~ここなら見つけてもらえる。大きく手を振った。
`);

const gagSeeds = readScripts(`
びっくりワープ|hero|star|rose|enter~主人公が、ひとつの星を見つけた。|explode~近づくと、星がぱっと周りへ飛び散った！|portal~びっくりして光へ飛び込む。少し離れた所へ逃げられた。
大きな箱の失敗|box|crown|amber|grow~王冠より目立ちたくて、箱が大きくなった。|rise~さらに高い場所へ。これで一番えらく見えるはず。|fall~でも高すぎて落ちてきた。えらくなるにも順番がある。
おやつの前でかくれんぼ|ghost|cake|rose|hide~おばけがケーキの後ろへ隠れた。|shake~待ちきれなくて、隠れたままぶるぶる震える。|reveal~おやつが気になって出てきた。かくれんぼはもう終わり。
猫の冷たい着地|cat|box|ocean|jump~猫が箱を飛び越えて、得意顔。|freeze~着地した場所が冷たくて、氷に閉じ込められた。|reveal~氷が消えた。次は着地する場所も見てから跳ぼう。
ロボットのごあいさつ|robot|hero|amber|wave~ロボットが主人公へ、元気に手を振った。|spin~もっと目立とうと、一回転も付け加える。|shake~張り切りすぎて、止まってもふらふら。でも来たことは伝わったね。
星の雨は重すぎる|slime|star|midnight|enter~星を一個だけ欲しくて、スライムが待っている。|rain~お願いが多すぎたのか、空から星がどっさり！|hide~星の後ろへ避難。今日は見るだけにしておこう。
月の目立ち方|moon|title|void|enter~月が看板の隣へ、目立たないようにやってきた。|spotlight~ところが、月の真上に明かりが当たる。|grow~こうなったら大きくなろう。隠れるつもりが、今日の主役。
踊りの止め方|bird|robot|forest|dance~鳥とロボットが、息を合わせて踊っている。|spin~鳥が調子に乗って、くるりと回った。|freeze~止まる合図で氷になった。そこまできっちり止めなくても。
箱の王冠コレクション|box|crown|rose|pull~箱が、大事な王冠をそばへ引いた。|stack~一個では足りなくて、王冠を上へ積んでいく。|hide~集めすぎて、自分が見えなくなった。飾るのは三個までにしよう。
ケーキの脱走|cake|cat|amber|walk~猫の前から、ケーキがそろそろ逃げていく。|jump~もっと遠くへと、思い切り跳んでみた。|sleep~逃げるのは疲れる。先に休んだので、距離はあまり変わらない。
おばけの登場リハーサル|ghost|hero|void|blackout~おばけは暗いところで、登場の時を待つ。|spotlight~突然、自分だけ明るく照らされた。|wave~驚かせる準備は失敗。普通にあいさつすることにした。
看板の落ち着きがない|title|robot|midnight|glitch~ロボットの前で、看板の姿がちらついている。|shake~直そうとしたら、今度はぶるぶる揺れた。|freeze~とうとう氷の中で停止。動かないけど、修理はまだ必要。
魚の追い越し|fish|bird|ocean|chase~魚が鳥の後ろを、急いで追いかける。|swap~場所を入れ替えて、やっと魚が前へ出た。|wave~勝ったと思ったけど、鳥は最初から競争していなかった。
大きすぎるスライム|slime|box|rose|grow~箱へ隠れたいのに、スライムが大きくなった。|hide~そのまま箱の後ろへ。これで隠れたつもり。|reveal~はい、見つかった！ 次は小さくなってから隠れよう。
植木が歩いた|plant|cat|forest|walk~猫の前を、植木がすたすた歩いてきた。|jump~見間違いではないよ。鉢ごとぴょんと跳ぶ。|sleep~歩く植木にも休憩は必要。猫の隣で堂々と眠った。
王冠より目立つ猫|cat|crown|amber|spotlight~王冠のお披露目なのに、猫へ明かりが当たった。|grow~猫は気をよくして、どんどん大きくなる。|sleep~そのままお昼寝。王冠のお披露目は、猫が起きてから。
箱運びを頼んだら|hero|box|forest|type~主人公が端末で、箱のマークを一度選んだ。|rain~一箱のはずが、箱がいくつも降ってきた！|shake~注文を間違えたらしい。届いた分を前に、二人とも震えている。
鳥の方向転換|bird|title|ocean|walk~鳥が、看板の方へ歩いていく。|spin~向きを直そうとしたら、一周回って同じ向き。|portal~もう近道で移動しよう。歩く練習はまた明日。
星になりすぎ|star|hero|midnight|enter~星が主人公へ、自分を見せに来た。|grow~もっと見てほしくて、ぐんぐん大きくなる。|shrink~近すぎて見えないと言われ、いつもの大きさへ戻った。
ロボットの猫まね|robot|cat|rose|mirror~ロボットが鏡の前で、猫のまねを練習する。|sleep~まずは横になって、じっとしてみた。|reveal~起きてみたけど、やっぱりロボット。姿まで変わるわけではない。
月のかくれんぼ|moon|box|midnight|hide~月が箱の後ろへ隠れた。|grow~隠れたまま大きくなって、箱からはみ出してしまう。|reveal~見つかる前に自分から登場。作戦変更、月見の時間です。
魚の列車初体験|fish|box|ocean|train~魚が、箱を乗せた列車の先頭へ立った。|bounce~走り終えたあとも、体がまだ弾んでいる。|sleep~揺れが心地よくて寝てしまった。次の出発はお昼寝のあと。
ケーキが増えた日|robot|cake|rose|type~ロボットが端末で、ケーキを選ぶ。|explode~隣のケーキが、仲間を連れてぱっと広がった。|celebrate~一人分ではなさそうだ。今日はみんなでお祝いしよう。
凍らないふりの失敗|ghost|slime|ocean|enter~おばけがスライムに、寒さなんて平気と近づく。|freeze~言ったそばから、おばけが氷に閉じ込められた。|reveal~やっと解けた。強がるより、ここで一緒に待っていよう。
王冠を呼んだら|hero|crown|amber|wave~主人公が王冠へ、こっちにおいでと手を振る。|orbit~王冠たちは来たけれど、周りを回り始めた。|spin~目で追っていたら主人公も回転。かぶるのは、止まってから。
猫の着ぐるみ作戦|slime|cat|rose|enter~猫の仲間に入りたくて、スライムが近づく。|dance~猫と同じ動きをするけれど、丸い形は変わらない。|transform~とうとう猫の姿になった。まねから始まる仲間入り。
星の配達が多すぎる|bird|star|midnight|pull~鳥が、配達する星をそばへ引き寄せた。|rain~上からも星が降ってきて、荷物は増えるばかり。|train~一羽では運べない。今日は星の列車で配達しよう。
箱のふりをする箱|box|hero|amber|freeze~箱が動かないふりをしていたら、本当に凍った。|reveal~氷が消えた。主人公はまだ隣で待っている。|dance~見られたならもういい。動ける箱だと踊ってみせた。
植木の回転サービス|plant|robot|forest|spotlight~ロボットに見せるため、植木に明かりが当たる。|spin~裏側も見てもらおうと、鉢ごと一回転。|shake~勢いが強すぎた。次からは半回転ずつにしよう。
おばけを追い越せない|hero|ghost|void|chase~主人公が、おばけに追いつこうと走る。|jump~跳べば追いつくと思って、大きくジャンプ。|swap~最後は場所を替えてもらった。近道には相談も必要。
小さな王冠の大行進|crown|box|amber|train~王冠が箱を乗せた列車で、堂々と登場した。|grow~到着したら、自分だけさらに大きくなる。|fall~張り切って高くなりすぎた。大きな王冠が、どすんと着地。
魚に向かない鏡|fish|moon|ocean|mirror~魚が鏡の前で、自分の向きを確かめる。|swap~向きの違いが気になって、月と立ち位置まで替えた。|reveal~向きを替えても、いつもの魚と月。気にしすぎることはなかったね。
ロボットの星よけ|robot|star|midnight|rain~ロボットの上へ、星が次々に降ってくる。|hide~星の後ろへ隠れようとするけれど、上は空いたまま。|portal~光をくぐって避難。隠れる場所は、横より上も大事。
おやつの前でフリーズ|hero|cake|rose|enter~待っていたケーキのところへ、主人公がやってきた。|freeze~うれしすぎて、文字どおり氷の中で固まった。|reveal~氷が消えた。喜ぶのは、ちゃんと体が動く範囲にしよう。
猫の看板当番|title|cat|amber|enter~猫の隣へ、今日の看板が自分でやってきた。|dance~目立つように、看板が小さく踊り始める。|sleep~誰より先に疲れて眠った。猫は起こす係になった。
月を釣るつもり|robot|moon|midnight|fish~ロボットが糸を垂らし、月を待っている。|pull~月を手元へ引き寄せた。大成功だと思ったら。|orbit~月たちはまた回り始めた。空のものはじっとしてくれない。
植木の王様ごっこ|plant|crown|forest|enter~植木が、王冠の横へやってきた。|grow~王様らしく見せたくて、大きく育つ。|shrink~大きすぎて王冠が目立たない。いつもの植木に戻ろう。
鳥の停止訓練|bird|box|ocean|chase~鳥が箱を追いかけ、止まる練習をしている。|freeze~止まれの合図で、氷ごとぴたりと停止した。|reveal~合格だけど、やりすぎ。次は氷を使わず止まってみよう。
スライムの月まね|slime|moon|midnight|float~スライムが月の隣で、ふわりと浮かぶ。|spin~丸い気分で一回転。まだ少し形が違う。|transform~最後は月そのものの姿に。今夜は月が一個多い。
箱はどこへ行った|hero|box|void|blackout~主人公が箱を見ていたら、急に暗くなった。|walk~見つけようと、暗いまま近づいていく。|reveal~明るくなったら目の前に箱。ちゃんと近づけていたね。
星のロボット手品|star|robot|rose|spotlight~ロボットの前で、星が手品を始める。|explode~ロボットが、何体もの姿で周りへ飛び出した！|wave~一体に戻ったロボットへごあいさつ。手品は、これでおしまい。
おばけの箱積み|ghost|box|void|build~おばけが箱を並べて、小さな山を作った。|stack~もっと隠れたくて、さらに上へ積んでいく。|hide~やっと姿が隠れた。でも箱の山の方が目立っているよ。
ケーキの王様|cake|crown|rose|grow~王冠の横で、ケーキが大きくなった。|spotlight~明かりの真ん中で、堂々と主役を務める。|shrink~でも元に戻れば、いつもの一人分。大きなお祝いもひと休み。
主人公の交代申請|hero|robot|amber|type~主人公が端末で、ロボットのマークを選んだ。|swap~隣のロボットと場所を交換。今度は君が先頭だよ。|sleep~交代が済むと、すぐお昼寝。休みたい理由はわかりやすい。
終わらない猫の見送り|cat|bird|forest|wave~猫が鳥へ、またねとあいさつした。|chase~でも離れるのが惜しくて、鳥の後を追いかける。|wave~追いついて、もう一度またね。見送りはいつまで続くかな。
`);

const storySeeds = readScripts(`
暗がりの白い友だち|hero|ghost|void|blackout~暗い場所に、主人公と白い何かがいる。|walk~何なのか確かめたくて、主人公が近づいていく。|reveal~明かりが戻ると、隣にいたのは小さなおばけだった。|jump~びっくりして跳んだけれど、おばけは追いかけてこない。|wave~落ち着いて手を振る。怖いものと決めつけて、ごめんね。|dance~並んで踊れば、もう怖くない。暗がりで友だちができた。
運びきれない箱|bird|box|amber|enter~鳥が、運ぶように頼まれた箱の前へ来た。|pull~一箱を引き寄せるだけでも、なかなか重い。|stack~集めてみると、運ぶ箱はまだこんなにあった。|shake~一羽で全部は無理そうだ。箱の前で考え直す。|train~列車を使えば、一度に運べる。鳥は先頭に立った。|celebrate~箱をまとめて運べた。力が足りなければ、方法を変えよう。
暗い場所からの出発|hero|star|midnight|blackout~暗くなってしまい、主人公が足を止めた。|reveal~そばに星があるとわかった。これなら一人ではない。|pull~はぐれないように、星を自分の近くへ引き寄せる。|orbit~星の仲間も集まり、主人公の周りを回り始めた。|rise~みんなと一緒なら怖くない。主人公が上へ進んでいく。|wave~星たちへ手を振る。足を止めた場所が、出発点になった。
大きくならなくても|robot|plant|forest|enter~ロボットが、小さな植木を調べに来た。|grow~上から見ようと、自分の体を大きくした。|shrink~これでは離れすぎる。いつもの大きさへ戻ろう。|pull~今度は植木を、そっと近くへ引き寄せる。|spotlight~明かりの下なら、葉っぱの様子もよくわかる。|wave~今日も元気そう。大きくなるより、近くで見る方がよかった。
箱置き場を作ろう|hero|box|amber|enter~主人公が、ばらばらの箱を片づけに来た。|pull~まず一箱を手元へ集めて、置く場所を決める。|stack~高く積めば片づくと思ったけれど、前が見えなくなった。|jump~向こうへ行くにも、毎回跳び越えなければならない。|pull~箱の山を横へ引き、自分の立つ場所を空けた。|celebrate~箱も自分も落ち着けた。片づけは、使いやすくなって完成だ。
隠れたままでは|ghost|cat|rose|enter~猫と遊びたいおばけが、そっとやってきた。|hide~でも話しかける勇気がなくて、猫の後ろへ隠れてしまう。|shake~このままでは気づいてもらえない。隠れながらもじもじ。|reveal~思い切って、猫の横へ姿を見せた。|wave~まずは小さく、ごあいさつ。言えたのはそれだけだった。|dance~それで十分だった。二人で動き始めれば、もう一緒に遊べる。
歩く植木の発表会|plant|hero|forest|enter~植木が主人公の前へ、発表をしにやってきた。|spotlight~明かりが当たった。今日の主役は、この植木だ。|shake~見られていると思うと、葉っぱまで震えてしまう。|walk~でも、一歩ずつ。植木は鉢ごと歩いてみせた。|jump~最後は小さなジャンプ。練習していた動きができた。|celebrate~発表は成功。大きな技ではなくても、自分でできた一歩だ。
空で会えたら|fish|bird|ocean|enter~魚が、鳥と同じ高さへ行きたくて近づく。|jump~勢いよく跳んでみたけれど、長くは浮かべない。|shake~着地して、ふらふら。跳ぶだけでは難しそうだ。|float~力を抜いてみたら、今度は体がふわりと浮いた。|swap~同じ高さで場所を交換。鳥のいた側も見られた。|wave~ようやく隣でごあいさつ。魚にも、空の友だちができた。
目立ちたい星|star|hero|midnight|enter~星が主人公のところへ、自分を見てほしくて来た。|grow~小さくて気づかれないと思い、大きくなる。|spotlight~明かりも当たった。でも大きすぎて、近くに並べない。|shrink~いつもの大きさへ戻れば、ちゃんと隣に立てる。|wave~今度は自分から、ごあいさつ。体の大きさは関係なかった。|dance~二人で踊り始めた。見てもらうより、一緒に遊ぶ方が楽しい。
王冠を届ける方法|hero|crown|amber|enter~主人公が、届ける王冠のそばへやってきた。|pull~一個を近くへ引く。見た目より、ずっと重い。|grow~自分が大きくなれば運べるかと、体を大きくする。|shrink~これでは置き場が狭い。元の大きさで考え直そう。|train~王冠を列車に乗せて、主人公が先頭に立った。|wave~まとめて配達できた。無理をする前に、使える方法を探そう。
月のそばへ|slime|moon|ocean|enter~スライムが、月と並んでみたくてやってきた。|jump~高く跳べば近づけると思い、勢いをつける。|shake~着地した体がふるふる。高く跳ぶだけでは足りない。|rise~今度はゆっくり、上へ上へと体を運ぶ。|float~慌てず浮かんでいれば、月と同じ景色を眺められる。|wave~やっと落ち着いてごあいさつ。急がない方が、長く一緒にいられた。
まねっこ入門|bird|robot|forest|enter~鳥が、ロボットと遊びたくてやってきた。|dance~まずは二人で、左右に揺れる動きを合わせる。|spin~鳥は上手くできたので、一回転も足してみた。|shake~張り切りすぎて、止まっても体がふらふらする。|reveal~落ち着いて元の姿勢へ。次は同じ動きからやり直そう。|wave~二人でできる遊びは、難しくしなくても楽しいね。
月の箱置き場|moon|box|midnight|blackout~暗い場所に、月と片づけ待ちの箱が残っていた。|reveal~明るくなったので、箱の位置がよくわかる。|pull~遠い箱を、月が少しずつ手元へ集める。|stack~置き場所を決めて、箱を一つずつ積み上げた。|spotlight~明かりの下で最終確認。箱は一か所へきれいにまとまった。|sleep~今夜の片づけは終了。月も安心して休むことにした。
お祝いは主役から|cake|hero|rose|enter~ケーキが主人公の前へ、お祝いの主役として登場した。|spotlight~明かりの中に立つと、もっと目立ちたくなる。|grow~大きなお祝いにしようと、ケーキが大きくなった。|shake~大きすぎてふらふら。これでは落ち着いてお祝いできない。|shrink~いつもの大きさへ戻った。隣に並べる方が安心だ。|celebrate~準備ができたら、みんなでお祝い。大きさより、一緒にいること。
隣を歩く約束|hero|ghost|void|enter~主人公が、おばけを散歩に誘いに来た。|pull~離れているので、まずは近くへ呼び寄せる。|chase~出発すると、おばけが先へ進む。主人公は追いかけるばかり。|swap~一度、先に立つ役を交換してみた。|wave~速すぎたら合図しよう。主人公が手を振って伝える。|dance~今度は同じ速さで動けた。二人の散歩は、歩幅を合わせてから。
魚へ見せるジャンプ|plant|fish|ocean|enter~植木が魚に、練習したジャンプを見せに来た。|walk~まずは歩いて、魚からよく見える場所へ出る。|jump~鉢ごと、ぴょん。昨日より高く跳べた気がする。|shake~着地した鉢がぐらぐら。跳ぶより、戻る方が難しかった。|reveal~姿勢を直して、もう大丈夫と顔を上げる。|wave~見てくれてありがとう。次は着地も練習しておこう。
休み方も仕事のうち|robot|star|amber|enter~ロボットが、星を集める仕事にやってきた。|type~端末で星のマークを選び、作業を始める。|rain~星が次々に降ってくる。全部を追うと、休む暇がない。|pull~近くの星だけ引き寄せて、今日の作業を区切ることにした。|sleep~まずはひと休み。動き続けるだけが仕事ではない。|reveal~休んで目を覚ました。残りはまた、落ち着いて進めよう。
おばけのお祝い|ghost|cake|rose|enter~おばけがケーキを見つけて、お祝いに来た。|hide~でも自分が主役だと知って、恥ずかしくて隠れてしまう。|reveal~せっかくのケーキが待っている。思い切って姿を見せた。|spotlight~明かりを受けても、もう逃げない。今日はここにいていい。|dance~うれしい気持ちを、少しだけ踊って伝える。|celebrate~お祝いを受け取れた。来年も、ケーキの隣で会おうね。
見送る練習|hero|bird|ocean|enter~主人公が、出発する鳥を見送りに来た。|chase~寂しくなって、つい鳥の後ろを追いかけてしまう。|pull~もう少しだけと、近くへ呼び戻した。|swap~今度は自分が見送る側へ。二人で場所を替える。|wave~また会おう。今度はちゃんと、手を振れた。|sleep~ほっとしたら眠くなった。次に会う日まで、ここでひと休み。
自分で選ぶ始まり|hero|title|amber|blackout~暗い場所で、主人公が次の一歩を迷っている。|reveal~明かりがつくと、隣にいつもの看板があった。|type~端末の看板マークを確かめて、まず一つ選んでみる。|walk~選んだだけでは進まない。主人公は自分で歩き出した。|portal~現れた光をくぐると、反対側へ出ることができた。|wave~もう一歩は踏み出せた。看板へ手を振り、次も試してみよう。
`);

const minigameSeeds = readScripts(`
流れ星キャッチ|hero|star|midnight|enter~星が降り始めた。←→で主人公を動かし、落ちてくる星を受け止めよう。|rain~星の真下へ移動すると得点になる。届く星から、一つずつ集めよう。|celebrate~最後まで星を集めよう。受け止めた数が、今回の記録になる。
鳥の障害物ラン|bird|box|ocean|enter~鳥が進む先に、箱や低い障害物がやってくる。|jump~↑かAでジャンプ。↓かBでかがみ、ぶつからずに進もう。|wave~ゴールまでもう少し。よけられた数が今回の記録になる。
ロボットのリズム練習|robot|cake|rose|type~流れてくる記号が、目印に重なる瞬間を待とう。|dance~重なった記号と同じボタンを押す。ぴったり合えば得点になる。|celebrate~最後の拍子まで続けよう。合った回数が、練習の成果だ。
おばけの順番記憶|ghost|box|void|reveal~四つの記号が、順番に光る。まずは押さずに見て覚えよう。|hide~光が消えたら、同じ順番で入力する。間違えたら最初から。|wave~落ち着いて最後まで。正しく思い出せた分が得点になる。
ぐらぐらバランス|hero|box|rose|enter~台が左右に傾く。←→で反対へ動かし、真ん中へ戻そう。|bounce~Aを押すと、少し安定する。大きく傾く前に、小さく調整。|celebrate~最後まで倒れずに保とう。安定していた時間が今回の得点。
猫の魚釣り|cat|fish|ocean|fish~←→で猫の位置を選ぶ。Aで糸を垂らして、魚を待とう。|pull~魚が糸の近くへ来たら、もう一度A。タイミングよく引き上げる。|wave~釣れた数が今回の記録。時間までに、もう一匹会えるかな。
スライムの星迷路|slime|star|forest|enter~スライムを出口の星へ連れていこう。↑↓←→で一歩ずつ進む。|walk~壁のある方へは進めない。曲がり角を見て、通れる道を探そう。|celebrate~星へ着けばクリア。遠回りしたら、来た道から確かめよう。
六つの記号入力|robot|title|midnight|type~画面に並ぶ六つの記号を、左から順番に入力しよう。|reveal~最後まで合うと次の問題へ進む。今、光っている記号を見よう。|celebrate~時間までに何問できるかな。正確な入力を重ねて得点を伸ばそう。
星空インベーダー|hero|star|midnight|enter~宇宙から敵の隊列が迫る。←→で移動、Aで弾を発射しよう。|rise~敵の弾をよけ、Bのシールドで身を守る。全滅させれば次の隊列だ。|celebrate~残りライフに気をつけて得点を伸ばそう。ゲームオーバー後はAで再挑戦。
星マークの出口|hero|box|void|enter~三つの出口から、星のマークがあるものを選ぼう。←→で移動する。|reveal~Aで扉を開く。正しい出口なら、次の三つの扉へ進める。|walk~星を見つけて、選んで、開く。時間までに何部屋進めるかな。
星の充電チャレンジ|robot|star|rose|type~Aを押して充電しよう。ゲージが20以上になったらBで送電する。|grow~充電は少しずつ減っていく。ためる、送るを繰り返して得点を増やそう。|celebrate~最後の送電まで続けよう。うまく送れた回数が今回の記録になる。
月と星のラリー|moon|star|ocean|enter~←→でパドルを動かして、落ちてくる星を打ち返そう。|bounce~星が落ちそうな場所へ先回り。パドルに当たればラリーが続く。|wave~次の一球にも追いつこう。続けて打ち返した回数が得点になる。
落ちものブロック|robot|box|amber|enter~落ちてくる四つ組のブロックを積もう。横一列をそろえると消える。|stack~←→で移動、↑かAで回転。↓で速く落とし、Bで一気に着地させる。|celebrate~上まで積むとゲームオーバー。Aで再挑戦して、消した列と得点を伸ばそう。
`);
const mechanics = ['catch', 'runner', 'rhythm', 'memory', 'balance', 'fishing', 'maze', 'typing', 'invaders', 'escape', 'clicker', 'pong', 'blocks'] as const;
minigameSeeds.forEach((seed, index) => { seed.mechanic = mechanics[index]; });

const endingSeeds = readScripts(`
早すぎるエンディング|hero|title|void|reveal~おしまい。始まったばかりなのに、もう終わりの看板が出てきた。|walk~本当に終わり？ 主人公が看板へ近づいて、確かめる。|type~端末の看板マークを選んでも、景色は終わらない。|pull~看板を近くへ引き寄せた。これは置かれているだけだった。|dance~せっかくなので、短いお祝い。早く見つけた人への、ごほうびです。|wave~仮のエンディングでした。読み終えたら戻って、次の三文字を試そう。
月へ行って帰るまで|hero|moon|midnight|enter~主人公が、月に会う最後の旅行へやってきた。|pull~遠くから眺めるだけではなく、今日は近くへ呼び寄せる。|rise~月のそばから、もう少し上へ進んでみる。|orbit~すると、小さな月たちが周りを回り始めた。|float~慌てず浮かんで、初めて見る動きを眺める。|wave~十分楽しんだので、月たちへありがとうと手を振った。|walk~名残惜しいけれど、帰る方へ一歩進もう。|portal~二つの光をくぐると、反対側へ戻ることができた。|reveal~帰ってきても月は見える。会えなくなるわけではない。|sleep~今日の旅行はおしまい。次に会う夜まで、ここでおやすみ。
箱片づけの大作戦|robot|box|amber|enter~ロボットの前に、最後の仕事の箱が残っている。|pull~まずは一箱、近くへ集めて作業を始める。|stack~高く積めば片づくと思ったら、箱の山ができてしまった。|jump~向こうへ行くにも跳ばないと通れない。これでは不便だ。|grow~大きくなってみても、箱の多さは変わらない。|shrink~体を元に戻し、運び方から考え直す。|train~列車を使い、箱をまとめて置き場所へ運んだ。|build~通り道から離れた場所へ、一つずつ並べ直していく。|celebrate~片づけ完了！ できないときも、方法を変えれば進められた。|sleep~今夜の仕事は本当におしまい。ロボットも安心して眠れる。
魚の飛行試験|fish|bird|ocean|enter~魚が鳥に、いつか同じ姿で飛んでみたいと近づく。|jump~最初は勢いに任せて、大きく跳んだ。|shake~着地して、ふらふら。これでは、まだジャンプだ。|type~端末の鳥のマークを見ながら、次の方法を考える。|float~体の力を抜くと、少し長く浮かべるようになった。|spin~うれしくなって回ってみたら、向きまでわからなくなった。|shake~慌てず止まろう。揺れがおさまるまで、その場で待つ。|reveal~いつもの姿勢に戻った。飛ぶ練習も、一つずつでいい。|wave~付き合ってくれた鳥へ、ひれを振ってお礼を言う。|transform~最後に、あこがれた鳥の姿へ。今度は本当に、一緒に飛べそうだ。
歩く植木の晴れ舞台|plant|hero|forest|enter~植木が主人公の前へ、最後の発表にやってきた。|grow~立派に見せたくて、いつもより大きくなる。|shrink~でも練習した動きは、小さな鉢の方がやりやすい。|spotlight~いつもの姿に明かりが当たる。準備はできた。|walk~まずは一歩ずつ。鉢ごと歩いて、真ん中へ出る。|jump~次はジャンプ。ためらわずに、体を持ち上げた。|shake~着地で少しぐらついた。でも、ちゃんと戻ってこられた。|reveal~姿勢を整える。失敗したところも隠さず、最後まで見せよう。|wave~これで発表はおしまい。見てくれた主人公へ葉を振った。|celebrate~できたことを、二人でお祝い。次の練習は、また明日から。
`);

const durations: Record<Category, number[]> = {
  remix: [2600, 3400, 4200, 5000, 3000, 3800, 4600, 2200, 3200],
  gag: [5200, 6500, 7800, 9200, 4500, 6100, 8300, 10000, 3500],
  story: [24000, 22000, 26000, 28000, 20000, 30000, 18000, 25000],
  minigame: [40000, 40000, 45000, 45000, 40000, 45000, 45000, 45000, 50000, 45000, 30000, 45000, 45000],
  ending: [60000, 80000, 85000, 90000, 90000],
};
const expectedCounts: Record<Category, number> = { remix: 90, gag: 45, story: 20, minigame: 13, ending: 5 };
const durationClasses: Record<Category, GameEvent['durationClass']> = { remix: 'short', gag: 'gag', story: 'event', minigame: 'minigame', ending: 'ending' };
const groups: [Category, Seed[]][] = [['remix', remixSeeds], ['gag', gagSeeds], ['story', storySeeds], ['minigame', minigameSeeds], ['ending', endingSeeds]];
for (const [category, seeds] of groups) {
  if (seeds.length !== expectedCounts[category]) throw new Error(`Catalogue count mismatch: ${category} has ${seeds.length}, expected ${expectedCounts[category]}`);
}

/** Stable lexicographic command space: exactly 6³ = 216 entries. */
const allCommands = SYMBOLS.flatMap(a => SYMBOLS.flatMap(b => SYMBOLS.map(c => `${a}${b}${c}`)));
/** A fixed permutation disperses misses and categories across the whole input space. */
const commandRank = (command: string) => {
  const index = allCommands.indexOf(command);
  return (index * 137 + 59) % 216; // 137 is coprime to 216.
};
const reserved = new Map<string, string>([
  ['remix-001', 'UUU'], ['remix-002', 'AAA'], ['story-001', 'DDD'], ['ending-001', 'BBB'],
]);
const availableCommands = allCommands.filter(command => ![...reserved.values()].includes(command)).sort((a, b) => commandRank(a) - commandRank(b));
let nextCommand = 0;

function makeEvent(seed: Seed, category: Category, index: number): GameEvent {
  const eventId = `${category}-${String(index + 1).padStart(3, '0')}`;
  const durationMs = durations[category][index % durations[category].length];
  const finalHold = category === 'ending' ? 4500 : category === 'story' ? 2500 : 650;
  const timeline: TimelineBeat[] = seed.beats.map((beat, beatIndex) => ({
    at: Math.round((beatIndex / Math.max(1, seed.beats.length - 1)) * (durationMs - finalHold)),
    text: beat.text, action: beat.action, actor: seed.actor, prop: seed.prop,
  }));
  return {
    eventId,
    command: reserved.get(eventId) ?? availableCommands[nextCommand++],
    title: seed.title,
    category,
    durationClass: durationClasses[category],
    durationMs,
    sceneType: `${category}-${seed.beats[0].action}`,
    timeline,
    assetIds: [...new Set([seed.actor, seed.prop, 'world'])],
    skippable: true,
    tags: [category, seed.actor, seed.prop, ...(seed.mechanic ? [seed.mechanic] : [])],
    palette: seed.palette,
    actor: seed.actor,
    prop: seed.prop,
    ...(seed.mechanic ? { mechanic: seed.mechanic } : {}),
  };
}

export const EVENTS: GameEvent[] = groups.flatMap(([category, seeds]) => seeds.map((seed, index) => makeEvent(seed, category, index)));
export const EVENT_BY_ID = new Map<string, GameEvent>(EVENTS.map(event => [event.eventId, event]));
export const EVENT_BY_COMMAND = new Map<string, GameEvent>(EVENTS.map(event => [event.command, event]));
export const COMMANDS: CommandEntry[] = allCommands.map(command => ({ command, eventId: EVENT_BY_COMMAND.get(command)?.eventId ?? null }));

/** Completion reward is outside the collectible 173 and consumes no command. */
export const TRUE_ENDING: GameEvent = {
  eventId: 'true-ending', command: '', title: '三文字からはじまった世界', category: 'ending', durationClass: 'ending', durationMs: 90000,
  sceneType: 'ending-reveal', skippable: true, palette: 'midnight', actor: 'hero', prop: 'star', assetIds: ['hero', 'star', 'world', 'title', 'endingWorld'], tags: ['completion', 'true-ending'],
  timeline: [
    { at: 0, action: 'blackout', text: '最後の演出を見つけたあと、主人公と星が静かに待っている。', actor: 'hero', prop: 'star' },
    { at: 7000, action: 'reveal', text: '明かりが戻った。全部見つけても、この星は隣にいる。', actor: 'hero', prop: 'star' },
    { at: 14500, action: 'enter', text: '猫が月のそばへ来た。最初の月見を、もう一度始めよう。', actor: 'cat', prop: 'moon' },
    { at: 22500, action: 'build', text: 'ロボットは箱を並べている。今度は、慌てず一つずつ。', actor: 'robot', prop: 'box' },
    { at: 31000, action: 'wave', text: 'おばけもケーキの隣でごあいさつ。もう隠れなくても大丈夫。', actor: 'ghost', prop: 'cake' },
    { at: 39500, action: 'grow', text: '植木が主人公の前で背を伸ばす。あの発表の練習は、まだ続いている。', actor: 'plant', prop: 'hero' },
    { at: 48000, action: 'type', text: '173の演出を、すべて見つけました。残り43通りは、何も起きない入力です。', actor: 'hero', prop: 'title' },
    { at: 56500, action: 'celebrate', text: '全発見、おめでとう！ 主人公からあなたへ、最後のお祝いです。', actor: 'hero', prop: 'crown' },
    { at: 65000, action: 'reveal', text: 'いつもの看板が待っています。見つけた演出は、図鑑から何度でも再生できます。', actor: 'hero', prop: 'title' },
    { at: 74000, action: 'rise', text: '月のそばで、星がまた上がっていく。今夜の空も、いつもどおりです。', actor: 'star', prop: 'moon' },
    { at: 82500, action: 'wave', text: '遊んでくれて、ありがとう。読み終えたら戻るボタンで、また遊びに来てください。', actor: 'hero', prop: 'star' },
  ],
};

if (EVENTS.length !== 173 || COMMANDS.length !== 216 || EVENT_BY_COMMAND.size !== 173 || COMMANDS.filter(entry => entry.eventId === null).length !== 43) {
  throw new Error('SECRET START catalogue integrity check failed');
}
