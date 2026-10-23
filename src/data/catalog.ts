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
宇宙までひと駅|hero|moon|midnight|rise~エレベーターの「上」を押した。|orbit~屋根を抜けて、月が階数を数えはじめる。|wave~到着階は宇宙。帰りの切符は星くず一枚。
はみだす大きさ|hero|title|amber|grow~背伸びをしたら、タイトルの屋根に頭が当たった。|shake~もう一度伸びて、画面の四隅を持ち上げる。|shrink~小さく戻っても、足跡だけは巨大なまま。
猫の月面散歩|cat|moon|midnight|jump~猫がソファから月へ飛び乗った。|bounce~低い重力で、着地より先に尻尾が帰る。|sleep~三日月を爪とぎにして、そのままお昼寝。
鳥の改札係|bird|box|ocean|enter~小鳥の駅に、切符のない箱が来た。|pull~鳥が箱から羽根一枚を引き出す。|train~羽根を改札に通したら、箱が特急になった。
花が先にごあいさつ|plant|hero|forest|rise~水をあげる前に、植木鉢が背を伸ばす。|wave~花が葉っぱの手で「おはよう」を返した。|rain~お礼に花が小さな雨を降らせてくれた。
配達された夕日|robot|box|amber|walk~ロボットが「夕日・われもの注意」を届けた。|reveal~箱を開くと、部屋いっぱいに夕焼けが広がる。|sleep~受取印を押すころには、世界がおやすみ色。
雲の洗濯日|hero|ghost|ocean|pull~物干し竿から、濡れた雲を一枚取り込む。|spin~くるりと絞ると、にわか雨がほどけた。|float~乾いた雲が、畳んだまま空へ帰っていく。
影の遅刻|hero|ghost|rose|walk~急いで出勤したのに、影だけが来ない。|chase~一拍遅れて、影がパンをくわえて走ってきた。|swap~影にかばんを預けたら、本体がついて歩いた。
魚の空中横断|fish|bird|ocean|float~横断歩道の信号が「泳いでよし」に変わる。|wave~魚の群れが、頭上の白線を渡っていく。|fall~最後の一匹が落とした泡が、水たまりになった。
箱の中の春|box|plant|forest|shake~冬物の箱から、くしゃみがひとつ聞こえた。|reveal~ふたを開けると、たんぽぽが靴下を押しのける。|rain~綿毛の雪が降って、部屋だけ春になる。
星の目覚まし|star|robot|midnight|bounce~目覚まし時計から、星が一個飛び出した。|chase~ロボットが止めるたび、星は別の机で鳴る。|sleep~星を枕の下に入れたら、朝まで流れ星の夢。
王冠の借り手|cat|crown|rose|enter~空の王座に、散歩中の猫が腰を下ろす。|rise~王冠が猫を選んで、すとんと耳に収まった。|sleep~国王の最初の仕事は、三分間のお昼寝。
逆さの水族館|hero|fish|ocean|mirror~水族館の床と天井が、静かに入れ替わる。|float~人間がガラスの向こう、魚がこちらを見学する。|wave~魚のガイドが「珍しい二本足です」と紹介した。
ケーキの建築士|robot|cake|rose|build~ロボットが定規で、生クリームの基礎を測る。|stack~スポンジの階段を積み、苺の展望台を据える。|celebrate~完成した家の表札は「本日中にお召し上がり」。
秘密の小さな海|hero|box|ocean|reveal~机の引き出しを開けると、潮のにおい。|fish~クリップを釣り針にして、小さな波へ垂らす。|rise~釣れたのは、なくした消しゴムの灯台。
ロボットの深呼吸|robot|plant|forest|grow~忙しいロボットが、深呼吸ボタンを押す。|rain~胸の排気口から、やさしい霧がこぼれた。|reveal~胸に植えた種が芽を出す。休憩も充電のうち。
満月のパン屋|moon|cake|amber|rise~開店のベルで、満月が窯から顔を出す。|shrink~ひとかけ配るたび、月は三日月になっていく。|grow~閉店すると、生地をこねて次の満月を仕込む。
スライムの切手|slime|box|ocean|fall~封筒に落ちたスライムが、四角く踏ん張る。|freeze~記念切手のふりをして、郵便箱へ潜り込んだ。|wave~届いた手紙には「ぼくも遊びに来ました」。
鳥の指揮台|bird|star|forest|spotlight~枝の指揮台に、小鳥がすっと立つ。|dance~羽根の合図で、草むらの星が拍子を取る。|celebrate~最後の一音で、夜明けがカーテンを開けた。
郵便受けの虹|box|bird|rose|shake~雨あがりの郵便受けが、七回くしゃみをする。|reveal~中には、色の端を丸めた一本の虹。|pull~鳥が端をくわえて、隣の屋根まで届けた。
鏡の向こうの休憩|hero|cake|rose|mirror~鏡の自分が、先に仕事を切り上げた。|enter~向こう側で椅子を出し、お茶を淹れている。|swap~入れ替わって一口。鏡にも休憩時間が必要。
重力の水曜日|hero|box|void|fall~水曜日だけ、重力が横を向く。|stack~机の上の箱が、壁に向かって積み上がる。|walk~壁の廊下を歩いて帰る。天井の店は定休日。
植木鉢の引っ越し|plant|box|forest|pull~植木鉢が根っこの靴ひもを結んだ。|walk~日だまりを追って、窓から窓へお引っ越し。|sleep~いちばん暖かい箱を見つけて、根を下ろす。
ねこの星座教室|cat|star|midnight|pull~猫が夜空の点を、毛糸のように引っぱった。|build~星と星をつなげたら、巨大な魚の輪郭。|chase~お手本を追いかけて、星座が一斉に逃げた。
おばけの透明傘|ghost|plant|ocean|rain~おばけが雨の駅前で、透明傘を開く。|hide~傘も本人も透明で、葉っぱだけが宙に浮く。|reveal~通行人には、空飛ぶ植木に見えました。
月を直す工具箱|robot|moon|midnight|enter~三日月の先が外れた。修理ロボが出動する。|build~なくしたネジの代わりに、星を一個はめ込む。|orbit~修理した月は、いつもより少しきらきら回る。
静かな積み木戦争|box|cat|amber|stack~箱の王国が、机の端まで城壁を積んだ。|enter~猫将軍が、交渉のために近づいてくる。|fall~一度のあくびで全員降伏。城壁は猫ベッドへ。
雨粒のエレベーター|slime|plant|ocean|rise~雨粒に乗ったスライムが、茎を上っていく。|bounce~葉っぱの階で乗り換え、つぼみの前で停車。|reveal~最上階で花が咲き、空の見晴らしをくれた。
ほうき星の掃除当番|star|moon|midnight|walk~ほうき星が、月の裏側の掃除に来た。|rain~尾を振るたび、古い願いがほこりになって舞う。|reveal~磨いた月に「おつかれさま」の文字が映った。
ケーキの潮干狩り|hero|cake|rose|fish~砂浜を掘ると、苺の先がひょこっと見えた。|pull~引き抜けば、貝殻サイズのショートケーキ。|rain~満ち潮はミルク。今日のおやつは海の恵み。
どこでも玄関|hero|box|amber|portal~床に置いた靴箱が、見知らぬ玄関につながる。|walk~一歩出ると、昨日なくした傘の置き場。|pull~傘を取って帰ると、靴が先に「ただいま」。
スライムの天気予報|slime|star|ocean|transform~スライムが雲の形になり、予報をはじめた。|rain~「ところにより」と言いながら、自分だけ雨。|reveal~明日は晴れ。体の中から太陽のおもちゃを出す。
花びらの券売機|plant|robot|forest|fall~一枚の花びらが、券売機に落ちた。|type~画面に「春行き・片道」と表示される。|train~ロボットが乗った列車は、桜並木を発車した。
おばけの足湯|ghost|slime|ocean|enter~足湯に、おばけがそろそろと入ってくる。|reveal~足のない本人より先に、湯気がうっとり。|float~くつろいだ湯気がおばけになって、一緒に帰る。
寝ぐせの森|hero|plant|forest|rise~朝、寝ぐせが一本だけ天井に届いていた。|grow~水で直そうとすると、枝分かれして森になる。|reveal~小鳥が来る前に、帽子の植木鉢でまとめよう。
紙箱の観覧車|box|moon|rose|build~空き箱が、折り目を開いて輪になった。|spin~月を乗せて、机の上の観覧車が回る。|wave~頂上から見えるのは、まだ読んでいない物語。
ひとさじの夜|hero|star|midnight|pull~紅茶に、夜空をひとさじ落とした。|orbit~カップの中で星が回り、湯気が銀河を描く。|sleep~飲み干すころには、まぶたに小さな夜が来た。
鳥の水やり便|bird|plant|forest|enter~郵便鳥が「今日のお水」を配達した。|rain~封筒の口から、ちょうど一杯分の雨が降る。|wave~花はお礼の蜜を、返信封筒に入れて渡した。
猫背のタイトル|title|cat|amber|shrink~タイトルが猫背になって、文字の間がせまい。|pull~猫が背中を伸ばすように、文字の端を引っぱる。|grow~すっと伸びたタイトル。猫はその下で大あくび。
冷蔵庫の北極|hero|moon|ocean|portal~冷蔵庫の奥で、氷の地平線が光った。|walk~牛乳の山を越え、バターの氷河を渡る。|reveal~北極点にあったのは、昨日のプリンの旗。
ロボットの花粉症|robot|plant|forest|enter~春の花畑で、ロボットがセンサーを開く。|shake~花粉を検知して、くしゃみの警報が点滅。|rain~鼻から紙吹雪。花もつられてくしゃみした。
星を包む八百屋|star|box|amber|fall~八百屋の棚へ、熟した星が落ちてきた。|pull~店主が新聞紙で包むと、夜空の匂いがする。|reveal~値札は「願いひとつ」。おつりは流れ星。
海底の街灯|fish|plant|ocean|walk~魚が暗い海底の道で、種をひとつ植える。|grow~芽は上へ伸びず、光る根を下へ広げた。|spotlight~通学路が明るくなる。魚たちの足元灯。
スライムの書道|slime|title|void|pull~スライムが墨をつけて、紙の端をつかむ。|walk~体ごと滑って、太い一本道を描いた。|reveal~書き上がった一文字は「のびのび」。
おばけのカメラ|ghost|cat|midnight|hide~おばけが猫の記念写真を撮ろうと構える。|spotlight~フラッシュが光る一瞬だけ、本人も写った。|reveal~写真の猫はびっくり顔。撮影者もびっくり顔。
月のハンモック|moon|star|midnight|pull~三日月が、両端に星のひもを結んだ。|float~風に揺られて、夜空のハンモックになる。|sleep~雲が一枚、順番待ちの番号札を持ってきた。
ケーキの誕生日|cake|hero|rose|enter~ケーキの前に、小さな主人公がろうそくを置く。|grow~ケーキ自身の誕生日だと聞いて、苺が背伸び。|celebrate~吹き消せないので、みんなで拍手して消した。
窓の中の窓|hero|box|ocean|reveal~窓を開けたら、もう一枚小さな窓がある。|shrink~次の窓、その次の窓と、景色が小さくなる。|enter~いちばん奥の窓から、小さな自分が手を振った。
鳥たちの月曜会議|bird|crown|forest|enter~枝の会議室に、鳥たちが集まった。|swap~議長の王冠を、一声鳴くたびに回していく。|train~議題は帰りの編隊。結論は「いつもの順番」。
ロボットの手編み|robot|cat|rose|pull~ロボットが、猫の抜け毛を一本ずつ集める。|build~計算通りに編んだ、ぴったりの手袋が完成。|reveal~ところが肉球用。猫の冬支度が先にできた。
花の地下鉄|plant|hero|forest|portal~花壇の小さな扉が、根っこの駅に変わる。|train~もぐら便に乗って、木の下を通り抜ける。|rise~出口はひまわりの展望台。運賃は水一滴。
影絵の水族館|hero|fish|void|spotlight~壁に手をかざして、魚の影をつくった。|float~手を離しても、魚は壁を泳いでいく。|rain~影の水しぶきが、夕方の部屋を涼しくした。
箱入りのお祭り|box|star|rose|shake~押し入れの箱から、太鼓が三回鳴る。|reveal~ふたを開けると、ミニチュアの縁日が開店。|dance~金魚すくいの星が、おみやげの空へ上がった。
猫の編集会議|cat|title|amber|walk~原稿の上に猫が座って、会議をはじめる。|hide~直してほしい一行だけ、尻尾で隠した。|reveal~修正案は「このあと、おやつ」。全会一致。
雨をほどく魚|fish|star|ocean|fall~結び目のある雨が、一滴落ちてきた。|pull~魚が鼻先でほどくと、長い水の糸になる。|wave~川まで編んで、迷子の雨を送り届けた。
幽霊列車の終点|ghost|box|void|train~誰も乗っていない列車に、おばけが乗った。|walk~座席ひとつずつに「おつかれさま」と声をかける。|sleep~終点で列車が眠る。今夜は線路もおやすみ。
太陽待ちのトースト|hero|cake|amber|rise~朝食が焼けない。窓の向こうはまだ夜。|pull~小さな太陽のひもを、ゆっくり引き上げる。|reveal~焼けたのは朝焼け色。バターは月のかけら。
くるくる図書館|hero|box|forest|spin~本棚が回り、読みたい本が背中側へ逃げる。|chase~追いかけるたびに、別の冒険が表紙を開く。|sleep~最後にたどり着いたのは「昼寝の作法」。
王冠の花びん|crown|plant|rose|fall~忘れられた王冠に、種がひとつ落ちた。|grow~宝石のすき間を抜けて、野の花が咲く。|wave~通りすがりの人が、王様より先に花へお辞儀。
スライムの砂時計|slime|box|ocean|fall~砂時計の上半分に、スライムが詰まっている。|shrink~細い首を、がんばって一滴だけ通り抜けた。|bounce~下に着いたら三分経過。ラーメンできました。
鳥の地図屋|bird|hero|forest|rise~鳥が地面の地図を、空から見直した。|build~道路の代わりに、風の通り道を描き込む。|wave~受け取った旅人は、凧を一枚買って出かけた。
月の忘れ物係|moon|box|midnight|pull~月が地上から、忘れ物の箱を引き上げた。|reveal~片方の靴、昨日の勇気、言いそびれた言葉。|rain~朝になったら、持ち主の窓へそっと返す。
ロボットの雨宿り|robot|plant|ocean|rain~急な雨で、ロボットの肩に小鳥が避難する。|grow~傘代わりの葉っぱを、胸の鉢から伸ばした。|walk~屋根ごと歩いて、みんなを駅まで送っていく。
ケーキの彗星|cake|star|rose|rise~誕生日の苺が、ろうそくの煙に乗った。|orbit~クリームの尾を引いて、机の周りを一周。|fall~皿へ着陸したら、願い事がひとつ増えていた。
箱の留守番|box|cat|amber|enter~留守番を頼まれた箱が、玄関で待っている。|hide~猫が入って、箱の中から外を見張った。|reveal~帰宅すると箱に札。「警備員、勤務中の睡眠」。
世界をたたむ夜|hero|moon|midnight|pull~夜の端をつまんで、空を一折り。|shrink~山も街も、布団サイズに折りたたまれる。|sleep~最後に月を枕へ置いて、世界が静かに眠る。
花粉の宅配便|plant|bird|forest|shake~花が花粉に、小さな宛名札をつけた。|float~風の便が来るまで、鳥の背中で待機する。|wave~隣の花へ到着。受領の印に実がひとつ。
自動販売機の海|robot|fish|ocean|type~ロボットが自販機の「海」を押した。|rain~缶の代わりに、ひと夏ぶんの波音が出る。|fish~つり銭口から、小魚が一匹ついてきた。
影の洗濯ばさみ|hero|ghost|void|pull~伸びすぎた夕方の影を、竿に干した。|wave~風に揺られて、影だけが手旗信号を送る。|swap~乾いた影を着ると、姿勢が少しよくなった。
星空の修学旅行|star|moon|midnight|train~星のクラスが、月行きの列車に乗る。|wave~窓から手を振るたび、地上で願いが上がる。|sleep~消灯時間。夜空はこっそり、少しだけ暗くなる。
猫の風見鶏|cat|bird|forest|rise~屋根に猫が登り、風見鶏の隣に座る。|spin~風向きが変わるたび、猫の耳も一緒に回る。|reveal~今日の風向きは「おさかな屋さんの方角」。
地下の空|hero|star|void|fall~井戸の底へ、空色の紙を落とした。|reveal~のぞきこむと、底にはもうひとつの星空。|rise~星が昇ってくる。井戸の水をくんだ朝の奇跡。
王様の順番札|hero|crown|amber|enter~パン屋の順番札が、たまたま王冠の形だった。|rise~周りが道をあけ、トングまでお辞儀をする。|reveal~呼ばれた番号は一番。即位は焼きたて三分間。
おばけの風鈴|ghost|star|ocean|pull~おばけが軒先に、自分の影を吊るした。|wave~風が吹くたび、見えない鈴が涼しく鳴る。|reveal~短冊には「ここにいます」。夏だけの住所。
くじら雲の駅弁|bird|box|ocean|enter~鳥が雲の売店で、ふわふわの駅弁を買う。|reveal~ふたを開けると、くじら雲が一頭泳ぎ出す。|rain~ひと口ぶんの雨が、おしぼりを濡らしてくれた。
苔の遠足|plant|hero|forest|walk~植木鉢の苔が、列をつくって外へ出る。|rise~靴の山、縁石の谷を越えて、石の丘へ。|sleep~お弁当は朝露。帰るころには鉢が少し緑色。
スライムの虫眼鏡|slime|star|ocean|grow~透き通ったスライムを通して、星をのぞく。|reveal~拡大された星に、掃除中の住人が見えた。|wave~手を振ったら、お互いの窓がぴかっと光る。
月がくれた栞|hero|moon|midnight|fall~読みかけの本に、細い月光が落ちた。|pull~紙からそっとはがすと、銀色の栞になる。|sleep~続きを読めるように、月はそこで待っている。
ロボットのたんぽぽ|robot|plant|forest|pull~ロボットが、願い事を入力して綿毛を吹く。|float~風は計算を外れて、綿毛を遠くへ運んだ。|reveal~予想外の場所で咲く花も、成功に数えよう。
魚の絵日記|fish|title|ocean|type~魚が泡で、きょうの日記を書きはじめる。|rise~文字は一文字ずつ浮かんで、水面へ逃げる。|reveal~岸に届いた泡を読むと「今日もよく泳いだ」。
朝を運ぶ手押し車|hero|star|amber|pull~夜道の向こうから、まぶしい台車が来た。|walk~積んでいるのは、街ごとに分けた朝の光。|rain~一軒ずつ配ると、窓が順番に目を覚ます。
箱の中の拍手|box|hero|rose|shake~誰もいない箱から、小さな拍手が聞こえる。|reveal~開けると、昨日がんばった自分からの贈り物。|celebrate~今日のぶんも一回足して、またふたを閉めた。
猫の透明な階段|cat|moon|midnight|jump~猫が何もない空中へ、ひょいと飛び乗る。|rise~見えない階段を上るたび、足跡だけが光る。|sleep~最後の段は月の縁。昼まで予約済みの席。
花時計の昼休み|plant|robot|forest|spin~花びらの時計が、正午を指した。|sleep~花が閉じ、ロボットも充電ケーブルを休ませる。|reveal~一枚だけ開いた花びらに「休むのも予定」。
おばけの貸し毛布|ghost|cat|rose|enter~寒そうな猫へ、おばけがふわりと近づいた。|hide~透明な体を毛布のように、そっとかける。|sleep~温かさはないけれど、ひとりぼっちではない。
最後の一粒の星|star|box|midnight|fall~夜空の袋から、星が一粒だけこぼれた。|bounce~机、窓、手のひらを跳ねて、居場所を探す。|spotlight~小さな灯りになった。今夜はここを照らそう。
タイトルの裏庭|title|plant|forest|pull~タイトルの端をめくると、草のにおいがした。|reveal~文字の裏で、まだ名前のない庭が育っている。|wave~庭師の花が一礼。次のコマンドの種をどうぞ。
止まった秒針の散歩|hero|star|amber|freeze~時計の秒針が止まったので、外してみた。|walk~小さな針は道しるべになり、机の上を散歩する。|spin~一周して時計へ帰る。遅れた時間は楽しかった。
水たまりの映画館|hero|fish|ocean|spotlight~雨あがり、水たまりに白い光がともる。|reveal~映るのは、さっき通った雲の冒険映画。|wave~上映終了。魚の支配人が波紋でお辞儀した。
おやすみの旗|bird|moon|midnight|pull~鳥が屋根の旗を、夕方の色に取り替える。|wave~旗がなびくと、町の窓がひとつずつ暗くなる。|sleep~最後の灯りは月に預けて、また明日。
`);

const gagSeeds = readScripts(`
くしゃみ式ワープ|hero|star|rose|enter~鼻がむずむず。あと一歩で玄関なのに。|explode~はっくしょん！ 星の粉と一緒に姿が消えた。|portal~到着したのは玄関の外。靴だけ家の中。
えらい箱|box|crown|amber|rise~空き箱に王冠を置いた。|grow~箱は胸を張り、ゆっくり玉座へ上がる。|fall~底が抜けた。偉いのに、底力が足りない。
透明になれないおばけ|ghost|cake|rose|hide~おばけが姿を消して、おやつをつまみ食い。|walk~宙に浮くケーキが、廊下をそろそろ進む。|reveal~口の周りのクリームだけ、ばっちり見えていた。
起立するプリン|slime|crown|amber|bounce~お皿のプリンに「起立！」と号令がかかる。|rise~細長く背を伸ばし、礼儀正しくお辞儀した。|fall~着席で崩れる。姿勢はよかったのに。
猫用パスワード|cat|robot|void|type~ロボットが「秘密の言葉をどうぞ」と尋ねた。|wave~猫は無言で肉球をぺたり。|reveal~認証成功。秘密の言葉より強い、かわいい。
靴下の片思い|hero|ghost|rose|pull~洗濯物から、片方だけの靴下が出てきた。|portal~もう片方は異世界で、別の靴下と暮らしていた。|wave~「元気でね」の一言。こちらは手袋に転職。
全自動お辞儀機|robot|crown|amber|enter~接客ロボットが、初めてのお客様を迎える。|spin~丁寧さを最大にしたら、お辞儀が一回転。|freeze~「またのお越しを」。顔がまだ床を向いている。
魚の水泳教室|fish|hero|ocean|enter~魚が人間に、泳ぎ方を教えてくれる。|wave~「まず、えらで呼吸」。説明がそこで止まる。|reveal~初日の宿題は、えらを用意することでした。
王様の抜けない王冠|hero|crown|rose|rise~憧れの王冠を、少し強めにかぶった。|pull~式が終わっても、びくともしない。|transform~その日から、入浴も就寝も戴冠式。
急ぎすぎる案内板|title|bird|amber|walk~「こちらです」と案内板が歩き出す。|chase~親切な案内板は、どんどん先へ走っていく。|reveal~目的地より先に、案内板を探す旅が始まった。
無限おかわり|hero|cake|rose|enter~ケーキをひとくち。おいしい。|grow~ひとくち食べるたび、ふたくちぶん増える。|hide~満腹の主人公が、ケーキから隠れました。
眠りのプロ|cat|star|midnight|sleep~猫が睡眠大会に出場する。|spotlight~開始の合図より前に、もう寝ている。|reveal~優勝発表にも起きない。表彰台はその場へ移動。
おばけの肝試し|ghost|robot|void|walk~おばけが初めての肝試しへ向かう。|reveal~角から出てきたのは、充電中のロボット。|shake~「電気代が上がったよ」で、おばけが絶叫。
鳥の着地失敗|bird|cake|rose|fall~鳥がケーキの上へ、華麗に着地する予定。|bounce~クリームがよく弾んで、鳥はもう一度空へ。|reveal~着地点には、足形ふたつの記念デコレーション。
スライムの面接|slime|box|ocean|enter~面接官が「長所を教えてください」。|grow~「どんな型にも、柔軟に対応できます」。|reveal~採用先は荷物のすき間。ぴったりの職場です。
タイトルの筋トレ|title|hero|amber|grow~タイトルが大きな文字を目指して腕立てする。|shake~百回できた。文字の太さも三倍になった。|reveal~ところが画面に入らない。採用されたのは略称。
王冠の充電|robot|crown|void|enter~光る王冠をもらったロボットが即位する。|spotlight~国民の前で、王冠をまぶしく点灯。|blackout~三秒後に電池切れ。充電中の王様はお休み。
月の宅配ピザ|moon|cake|amber|enter~「丸いものを一枚」と、夜空から注文が入る。|rise~配達員が持ってきたのは、大きな満月。|shrink~ひと切れ持ち帰られて、今夜は三日月です。
顔認証の寝ぐせ|hero|robot|void|type~朝の主人公が、顔認証の前に立つ。|shake~「未知の生物です」。寝ぐせだけが立派すぎた。|reveal~髪を押さえたら通過。今日のラスボスは枕。
猫の荷物検査|cat|box|amber|enter~宅配箱を開けようとすると、猫が前に出る。|hide~自ら箱に入り、内側の安全を確かめた。|sleep~検査終了は未定。荷物は箱の外で待機中。
花の早口ことば|plant|bird|forest|wave~花が「なまむぎ」と、早口ことばに挑戦。|shake~「なまごめ」のところで花粉がむずむず。|explode~最後は「なまたま、はっくしょん！」。
ねじ一本の旅|robot|star|midnight|fall~ロボットのねじが一本、ころんと落ちた。|chase~追って角を曲がると、ねじは星空へ転がる。|reveal~願いはひとつ。「戻ってきてください」。
箱から箱へ|hero|box|amber|reveal~大きな箱を開けると、小さな箱があった。|shrink~小さな箱の中には、さらに小さな箱。|grow~最後の箱を開けたら、最初の大きな箱が出た。
高速お茶会|hero|cake|rose|enter~のんびりお茶会の、開催を宣言します。|train~お茶もケーキも、特急列車で通過した。|reveal~のんびりしたのは、片づけの時間だけでした。
幽霊の体重計|ghost|box|void|rise~おばけが体重計へ、ふわりと乗る。|type~表示は「ゼロ」。思わずガッツポーズ。|fall~床に落ちたおやつの袋だけ、しっかり三キロ。
ピントが来ない鳥|bird|robot|ocean|spotlight~記念撮影。「動かないで」とロボットが言う。|freeze~鳥は完璧に止まった。風も止まった。|reveal~カメラ担当のロボットが、うれしくて手ぶれ。
ケーキの防災訓練|cake|hero|rose|shake~机が揺れた。ケーキの避難訓練です。|fall~苺が先に脱出し、クリームも滑り降りる。|reveal~避難所は主人公のお皿。安全においしく保護。
鏡のじゃんけん|hero|ghost|void|mirror~鏡の自分と、じゃんけんを始める。|wave~あいこ、あいこ、またあいこ。|reveal~急に向こうが後出し。「今日は勝ちたい気分」。
一日駅長の魚|fish|crown|ocean|enter~魚が駅長の帽子をかぶって着任した。|wave~出発の合図に、立派な泡をひとつ。|train~全列車、水中行き。乗客には浮き輪を配布。
ロボットの涙|robot|plant|forest|reveal~映画の感動シーンで、ロボットの目が潤む。|rain~涙だと思ったら、自動洗浄モードだった。|wave~でも花には届いた。「ありがとう、いい映画だね」。
月の満員電車|moon|star|midnight|train~満月が朝の満員電車に乗り込んだ。|shrink~ドアに合わせて、ぎゅっと細くなる。|reveal~降車するころには三日月。次の休みは満月に戻ろう。
かくれんぼ名人|box|ghost|void|hide~おばけが「もういいよ」と声をかけた。|walk~箱が探しに来たけれど、誰も見当たらない。|reveal~透明なおばけに、反則の札が一枚貼られた。
王様のお使い|hero|crown|amber|walk~王様が変装して、パンを買いに行く。|hide~顔を隠し、声も変えた。計画は完璧。|reveal~王冠を外し忘れた。「いつもの王室セットですね」。
魚の砂風呂|fish|box|ocean|enter~魚が、評判の砂風呂へやってきた。|hide~砂に埋まって、三秒だけ目を閉じる。|jump~「先に水風呂をください！」。順番が逆でした。
星の願い事窓口|star|hero|midnight|enter~星の窓口へ、願い事を持っていった。|type~「願い事を三つに増やしてください」。|reveal~番号札を渡された。次の窓口は一億年待ち。
逆再生のあくび|cat|moon|midnight|sleep~猫が大きなあくびを、ひとつした。|mirror~映像を逆再生すると、月を吸い込んでいる。|reveal~口を開けて返却。今夜の月には歯形がひとつ。
運ぶ側の宅配便|box|robot|amber|enter~宅配ロボが、大きな荷物に向かう。|swap~箱が足を出し、ロボットをひょいと持ち上げた。|walk~配達先は充電所。お疲れの配達員をお届け。
スライムの握手会|slime|hero|ocean|wave~スターのスライムが、握手会を開いた。|pull~手を握ると、腕がびよーんと離れない。|reveal~全員と握手したまま、ひとつの輪になりました。
鳥の目覚まし代行|bird|cat|forest|enter~鳥が「朝ですよ」と、猫の耳元で歌う。|sleep~猫は半目で、子守歌のリクエストを出す。|reveal~鳥まで眠った。目覚まし代行、午後より営業。
王冠のサイズ交換|crown|slime|rose|enter~サイズ違いの王冠を、交換しに来た。|grow~店員のスライムが、試着して大きさを確認。|transform~王冠に合わせて本人が伸びた。「交換不要です」。
タイトルの出番待ち|title|hero|void|hide~タイトルが舞台袖で、出番の合図を待つ。|spotlight~ライト点灯。いよいよ本番の大見得。|fall~「おしまい」。間違えて最後の札を持ってきた。
花のくじ引き|plant|hero|forest|pull~花占いで、花びらを一枚引いた。|reveal~裏には「大吉」と書いてある。|grow~次も次も大吉。花が励ますために仕込んでいた。
宇宙の呼び出し音|hero|star|midnight|type~電話番号を一桁間違えたら、宇宙につながる。|orbit~保留音に合わせて、惑星が順番に回りだす。|reveal~「ただいま公転中です」。折り返しは一年後。
猫のカウントダウン|cat|cake|rose|type~おやつまで、三、二、一。|freeze~ゼロの直前で猫が止めた。|reveal~待つ時間を延ばせば、おやつが減らないと気づいた。
立入禁止の看板|hero|title|amber|walk~「この先立入禁止」の看板が歩いてくる。|chase~避けても避けても、看板は前へ回り込む。|reveal~読めた小さな追記。「工事はあなたの後ろです」。
`);

const storySeeds = readScripts(`
地下三階のもうひとり|hero|ghost|void|fall~エレベーターの表示が、地下三階で止まった。|blackout~扉の向こうで、同じ足音が一歩遅れて返る。|walk~壁には、自分の名前で書かれた帰り道。|reveal~振り向くと、幼いころに描いたおばけが立っていた。|wave~「ずっと迎えを待ってた」。小さな手を取る。|rise~地上へ戻るころ、影がひとつに重なった。
配達不能の手紙|bird|box|amber|enter~鳥の郵便屋に、宛名のない手紙が一通残った。|walk~消えかけた切手を頼りに、古い駅へ向かう。|reveal~待合室には、廃線の日から動かない時計。|pull~手紙を開くと「待っていてくれて、ありがとう」。|train~時計が一分動き、最後の列車の音がした。|wave~鳥は返事を、風に乗せて送り出した。
月のない夜の灯台|hero|star|midnight|blackout~月が休んだ夜、港の灯台も暗くなった。|walk~灯台守は、浜に落ちた小さな星を拾う。|rise~長い階段を上るあいだ、星の光が弱くなる。|reveal~屋上で星は、帰る空を探していたとわかる。|wave~手を離す。星は仲間を連れて空へ上がった。|spotlight~船の道が光る。灯台も、ひとりではない。
ロボットが覚えた嘘|robot|plant|forest|enter~枯れかけた花に、ロボットが水を届けている。|type~花が尋ねた。「明日も、きっと咲けるかな」。|freeze~予測結果は低かった。返事の計算が止まる。|reveal~ロボットは初めて「待っているよ」と答えた。|rain~夜中じゅう、葉のそばで朝露を集める。|grow~一輪咲いた。予測にない朝を、記憶へ保存。
箱の国の引っ越し|box|hero|amber|reveal~古い部屋を片づけると、箱の国が見つかった。|walk~住民たちは、捨てられる日を心配している。|build~主人公は、新しい箱に橋と住所を作った。|train~箱の列車が、思い出の荷物を一つずつ運ぶ。|wave~最後の住民が、空っぽの国にお辞儀した。|reveal~新居の隅から、小さな「ただいま」が聞こえた。
透明な転校生|ghost|cat|rose|enter~教室に、姿の見えない転校生がやってきた。|hide~誰も席を見つけられず、おばけは声を小さくする。|walk~一匹の猫だけが、空の椅子へ歩いていった。|sleep~猫は膝に丸くなり、教室が居場所に気づく。|reveal~机に名前の札が置かれた。「一緒に帰ろう」。|wave~放課後、猫と浮いたかばんが並んで進む。
十年後の花屋|plant|hero|forest|enter~閉店した花屋の前で、主人公が種を拾う。|rain~毎朝一杯の水。返事のない鉢に話しかけた。|grow~季節が回り、枝は看板を覆うほどに伸びる。|reveal~花の中から、十年前の店主の手紙が現れた。|type~「この店を覚えてくれて、ありがとう」。|celebrate~枝の下で、小さな花屋をもう一度開いた。
泳げない魚の地図|fish|bird|ocean|fall~ひれを傷めた魚が、浅い池で空を見ていた。|enter~渡り鳥が降りて、見知らぬ海の話をする。|type~魚は話を、底の砂へ地図として描きはじめた。|wave~通りかかった魚が、地図を頼りに旅へ出る。|reveal~旅人はおみやげの貝で、地図を少しずつ増やした。|float~動けなくても、世界はここへ流れてきた。
最後の星の店|star|hero|midnight|enter~夜の商店街で、一軒だけ星の店が開いていた。|reveal~棚には、かなわなかった願いが並んでいる。|pull~主人公は、子どものころの自分の願いを選ぶ。|freeze~値札は「もう一度、やってみる時間」。|rise~願いを胸に入れると、店は朝の光に溶けた。|walk~帰り道、ずっと閉じたままのノートを開く。
王冠を置いた日|hero|crown|amber|enter~王様は毎朝、重い王冠をかぶっていた。|walk~ある日、王冠を置いて、街を歩いてみる。|pull~荷物を落とした子へ、何も名乗らず手を貸した。|reveal~返ってきたのは「王様」ではなく「ありがとう」。|sleep~夜、王冠は机の上で静かに眠っている。|wave~翌朝の王様は、昨日より少し軽い足取り。
スライムの遠い家|slime|moon|ocean|float~満潮の夜、浜にスライムが流れ着いた。|wave~月へ伸ばした手は、すぐ波にほどけてしまう。|walk~主人公は毎晩、一緒に丘まで登った。|reveal~水面に満月が映ると、スライムは笑った。|portal~月の光の道を渡り、海の向こうへ帰っていく。|rain~残った一滴が、朝になってもきらきら光った。
音を失くした鳥|bird|robot|forest|enter~歌を忘れた鳥が、修理屋の戸をたたいた。|type~ロボットは音の部品を探すが、どこにも故障がない。|freeze~二人で黙って、窓の外の風を聞いた。|reveal~葉の音、雨どいの音、遠くの誰かの笑い声。|dance~鳥がその三つをまねる。新しい歌が生まれる。|wave~修理代は一曲。窓は今日も開けておこう。
月の裏の忘れ物|moon|box|midnight|reveal~月の裏には、地上の忘れ物をしまう倉庫がある。|pull~係の月が、名前のない小箱を見つけた。|enter~中には「初めて歩けた日」の小さな拍手。|orbit~持ち主の大人は、今夜も失敗を数えている。|rain~月は夢へ拍手を返した。たった一歩も進歩だよ。|rise~朝、持ち主は昨日より一駅手前で降りて歩く。
ケーキを分ける約束|cake|hero|rose|enter~二人で食べるはずのケーキに、一人が遅れている。|freeze~ろうそくは短くなり、窓の外には夜が来た。|walk~玄関を開けると、道の先に迷子が立っている。|pull~迎えに来た主人公の手に、ろうそくの小さな灯。|reveal~遅れた理由は、拾った猫を家へ届けていたから。|celebrate~三つに分けよう。約束より、ひとかけ増えた。
影が旅に出る日|hero|ghost|void|pull~長年いっしょの影が、旅の荷物をまとめはじめた。|wave~「夕方までには帰る」。影は角を曲がって消える。|walk~影のない主人公も、知らない道を歩いてみた。|reveal~古い公園で、影は別の影と踊っていた。|dance~主人公も輪に入る。いつもの足が軽くなる。|swap~帰りは影が前を歩く。次の散歩道を教えてくれた。
植木鉢の航海日誌|plant|fish|ocean|float~捨てられた植木鉢が、川を下って海へ出た。|wave~魚は嵐の晩、鉢の下に集まって休んだ。|grow~鉢は根を伸ばし、流れに負けないいかりにする。|rain~集まる雨と鳥のおみやげで、緑の船が育つ。|reveal~地図にはない、小さな島になっていた。|sleep~航海日誌の最終行は「ここを家にします」。
駅の眠らない時計|robot|star|amber|enter~無人駅のロボットは、終電後も時計を見ている。|train~十年前に来なかった列車の、到着を待っていた。|reveal~流れ星が一枚の古い時刻表を落とす。|type~余白には「待つ仕事は、もう終えていい」。|sleep~ロボットは初めて、時計の音を子守歌に眠る。|rise~始発の朝、自分で行き先を選んで乗り込んだ。
おばけの誕生日|ghost|cake|rose|enter~おばけは、自分の誕生日を思い出せなかった。|walk~町じゅうに聞いたが、誰も昔を知らない。|reveal~小さな店で「今日、お祝いすればいい」と言われる。|build~ケーキにろうそくを一本立て、新しい日付を書く。|celebrate~透明な頬が、ろうそくの明かりで少し赤くなる。|wave~来年もこの日に会おう。未来の約束ができた。
空に返す絵本|hero|bird|ocean|reveal~古い絵本から、描かれた鳥が抜け出した。|chase~ページをめくるたび、失くした色を一枚ずつ集める。|grow~最後のページで、鳥に本物の羽根がそろった。|freeze~閉じればまた読める。開けば遠くへ飛んでしまう。|wave~主人公は窓を開け、物語の続きを空へ渡した。|type~白い最終ページに「それから」とだけ書き足す。
まだ名前のない朝|hero|title|amber|blackout~タイトルも行き先もない、真っ白な朝が来た。|walk~主人公は、昨日通らなかった道へ進む。|enter~曲がり角で、同じように迷う誰かと出会う。|build~二人で看板を作り、まだない道へ置いた。|reveal~看板には「ここから先は、これから」。|rise~朝日が文字を照らす。今日の名前は、歩いて決める。
`);

const minigameSeeds = readScripts(`
流れ星の採集係|hero|star|midnight|enter~今夜は星の収穫日。左右に動いて、落ちてくる星を受けとめよう。|rain~明るい星は空の種。受けとめたぶんだけ、次の夜が豊かになる。|celebrate~もうすぐ収穫の時間。今夜は何粒の星を、かごへ迎えられるかな。
屋根の上の朝刊便|bird|box|ocean|train~朝刊の配達便が発進。↑かAでジャンプ、↓かBでかがんで障害物をよけよう。|jump~箱を飛び越え、鳥の下をくぐる。朝刊を待つ窓はもうすぐ。|wave~配達もあと少し。よけられた障害物の数が、きょうの腕前。
ロボットの拍子工場|robot|cake|rose|type~工場のベルトが動きだす。印が重なった瞬間に、同じ記号で合図を送ろう。|dance~ちょうどのリズムで、生クリームの飾りをひとつずつ置いていく。|celebrate~もうすぐ交代の時間。きれいに刻めた拍子が、おいしさのしるし。
おばけの記憶金庫|ghost|box|void|reveal~金庫が4つの光を順番に見せる。同じ順番で押して、記憶を返そう。|hide~光が消えたら、頭の中の道しるべをたどる。間違えても先頭から再挑戦。|wave~もうすぐ金庫が閉まる。覚えた順番を、おばけにもう一度届けよう。
箱と猫の綱渡り|hero|box|rose|enter~箱と猫を乗せた台がぐらぐら。左右で傾きを戻し、まっすぐ保とう。|stack~風が吹くたび猫の耳がゆれる。Aで安定させながら、少しずつ調整。|celebrate~降りる場所はもうすぐ。安定していられた時間が、渡り手の腕前。
月の池の忘れ物|cat|fish|ocean|fish~池の忘れ物を探す前に、魚にご挨拶。左右で位置を決め、Aで糸を垂らそう。|pull~魚が糸の近くへ来たら、もう一度A。合図を見てやさしく引き上げる。|reveal~釣れた魚に探し物を尋ねよう。日が出るまでに、もう一匹会えるかな。
根っこの郵便迷路|slime|plant|forest|enter~地下の分かれ道を進もう。壁をよけて、出口の星へ手紙を届ける。|walk~上も下も、根のトンネル。ひとつ先の角を見て道を選ぼう。|wave~配達の締切が近づいてきた。進んだ道は、点々と足跡になって光る。
星の活字印刷所|robot|title|midnight|type~画面に示された6つの記号を、その順番で入力しよう。夜空の新聞を刷る時間。|reveal~正しい文字がそろうと、次のコマンドが届く。光る記号から、急がず確かに。|celebrate~夜空へ届ける締切はもうすぐ。組めた文字数が、今夜の作業ぶん。
庭を守るおばけ隊|ghost|star|forest|enter~庭へ降りてくるいたずらおばけを、光の玉で追い払おう。左右で移動、Aで発射。|rise~一列ずつ照らして、花壇を守る。危ないときはBのシールドでひと息。|wave~見回りの交代はもうすぐ。あと少し、庭へ光を届けよう。
消灯前の図書室|hero|box|void|enter~閉館までに出口を目指そう。左右で扉を選び、星の目印がある扉をAで開く。|reveal~次の部屋にも三つの扉。司書の星が、帰り道を教えてくれる。|walk~貸出カウンターまでもう少し。借りた本を抱えて、次の星を探そう。
星を灯す充電係|robot|star|rose|enter~夜空のランプへ電気を送ろう。Aで充電し、20以上たまったらBを押す。|grow~充電は少しずつ抜けていく。ためる、送るをくり返して星を灯そう。|celebrate~夜の点灯式はもうすぐ。最後のひとつへ、もう一回ぶんの充電を。
雲の上の月球|moon|star|ocean|enter~パドルを動かし、星のボールを打ち返そう。雲のコートでラリー開始。|bounce~角度をつけて打ち返し、落ちる前に先回り。空にも白熱の試合がある。|wave~試合時間はあと少し。次の一球へ、ラケットを合わせよう。
三つの箱の向こう|hero|box|amber|enter~箱が三つ並んでいる。左右で選んでAで開こう。どの箱にも小さな出会い。|reveal~月、猫、ケーキ。正解のない選択だから、気になった箱を選んでいい。|wave~お店が閉まる前に、もうひと箱。きょうはどんな可能性を見つけられるかな。
`);
const mechanics = ['catch', 'runner', 'rhythm', 'memory', 'balance', 'fishing', 'maze', 'typing', 'invaders', 'escape', 'clicker', 'pong', 'choice'] as const;
minigameSeeds.forEach((seed, index) => { seed.mechanic = mechanics[index]; });

const endingSeeds = readScripts(`
もう終わったことにする|title|hero|void|reveal~おしまい。早くもエンディングに到着しました。|freeze~……本当に？ 主人公が画面の外をのぞきこむ。|type~制作：ここまでの三文字。出演：押してくれたあなた。|enter~通りかかった猫が、流れはじめたスタッフロールを見上げる。|walk~「まだ散歩もしてないよ」と、文字の間を歩いていく。|reveal~背景の裏には、開いていない扉がいくつも並んでいた。|pull~猫が「おしまい」の札を引っぱると、裏に「つづけてもいい」。|rise~主人公は帽子をかぶり直す。急いで結末を決めなくてもいい。|wave~これは、ひとつめに見つけた出口。入口はいつでも待っている。|type~仮のスタッフロール、終了。次の三文字へ。
月の駅の終電|hero|moon|midnight|train~月の駅に、最後の列車が入ってくる。|enter~乗客は猫、おばけ、配達を終えた鳥。みんな静かな顔。|wave~駅員の星が、地上行きの切符へ穴を開ける。|reveal~切符の裏には、今日見つけた小さな景色が描かれていた。|walk~主人公は窓際へ座り、知らなかった夜道を見送る。|orbit~列車が月を一周すると、遠い町の灯りが朝の色に変わる。|type~車内放送。「忘れ物は、明日の楽しみにお預けください」。|sleep~猫は眠り、おばけは窓の反射と並んで揺れている。|rise~最初の駅に到着。出口の先には、また白い画面がある。|wave~おかえり。旅の続きは、あなたの次の三文字から。
箱の王国の戴冠式|box|crown|amber|enter~小さな箱の国から、主人公へ招待状が届いた。|build~道は折り紙、門は空き箱。誰かの手作りでできた都。|wave~一度助けた花も、魚も、広場に集まっている。|reveal~差し出された王冠は、重い金ではなく、色とりどりの紙。|rise~「この国を見つけてくれた人に」。王冠がそっと頭に乗る。|type~大切な仕事は、名前のない箱にも目を向けること。|celebrate~王様の最初の宣言は「みんなに、座る場所をひとつ」。|build~広場に椅子が増え、遠くの住人にも席ができる。|reveal~玉座を空けた主人公は、輪の中のひとつに座った。|wave~式は終わり。箱の国は、これからも誰かの居場所です。
海の向こうの手紙|fish|bird|ocean|enter~浜辺に、読めない文字の手紙が流れ着いた。|fish~魚は海の道をたどり、鳥は空から島を探す。|walk~主人公は浜の文字を、毎日ひとつずつ写し取った。|reveal~季節が変わるころ、最初の言葉が読める。「元気ですか」。|type~知らない誰かが、返事の来ない海へ挨拶を送り続けていた。|pull~主人公は新しい瓶へ、町のみんなの小さな絵を入れる。|wave~返事は読めなくても伝わるように、笑った顔をいちばん上へ。|float~瓶が沖へ出る。魚が先導し、鳥が帆の代わりに風を呼ぶ。|rise~水平線の向こうで、灯りが一度、二度と瞬いた。|reveal~世界は思ったより広い。そして、思ったより近くにいる。
庭が世界になる日|plant|hero|forest|enter~タイトルの裏で育った小さな庭に、朝が来た。|grow~一鉢の花から、窓まで届く枝が伸びている。|walk~猫は日だまりを見つけ、ロボットは水やりの当番札を掛けた。|rain~雨の日も晴れの日も、誰かが少しずつ世話を続けた。|reveal~庭は画面の外へ広がり、道を知らない旅人を迎えている。|build~主人公は門を作り、鍵の代わりに三つのボタンを並べた。|type~看板には「どんな順番でも、まずは押してみてください」。|celebrate~うまくいった日も、何も起きない日も、ここへつながっていた。|wave~門を開けたまま、主人公は花の隣に腰を下ろす。|rise~新しい足音が近づく。世界は、まだ育っている。
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
    { at: 0, action: 'blackout', text: 'すべての扉の向こうを、あなたは見つけた。', actor: 'hero', prop: 'star' },
    { at: 7000, action: 'reveal', text: '画面に残ったのは、最初と同じ六つのボタン。', actor: 'hero', prop: 'title' },
    { at: 14500, action: 'enter', text: '猫が来た。月が顔を出した。おばけも、ロボットも、庭の花も。', actor: 'cat', prop: 'moon' },
    { at: 22500, action: 'build', text: '見つけた景色をひとつずつ並べると、知らなかった町の地図になる。', actor: 'robot', prop: 'box' },
    { at: 31000, action: 'wave', text: '何も起こらなかった道にも、小さな足跡はちゃんと残っていた。', actor: 'hero', prop: 'star' },
    { at: 39500, action: 'grow', text: '成功だけでは、こんなに広い世界にならなかった。', actor: 'plant', prop: 'star' },
    { at: 48000, action: 'type', text: '173の出会い。43の静かな道。そのどれもが、あなたの探索でした。', actor: 'title', prop: 'star' },
    { at: 56500, action: 'celebrate', text: '世界のみんなから、ここまで歩いたあなたへ、ひとつの大きな拍手。', actor: 'hero', prop: 'crown' },
    { at: 65000, action: 'reveal', text: '最後の秘密は、扉の中にはなかった。開けてみようと思った、その指先にあった。', actor: 'hero', prop: 'title' },
    { at: 74000, action: 'rise', text: 'SECRET START — ぜんぶ見つけた先にも、始まりは残っている。', actor: 'star', prop: 'moon' },
    { at: 82500, action: 'wave', text: '遊んでくれて、ありがとう。お気に入りの世界へ、いつでも帰ってきてください。', actor: 'hero', prop: 'star' },
  ],
};

if (EVENTS.length !== 173 || COMMANDS.length !== 216 || EVENT_BY_COMMAND.size !== 173 || COMMANDS.filter(entry => entry.eventId === null).length !== 43) {
  throw new Error('SECRET START catalogue integrity check failed');
}
