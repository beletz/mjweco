// ==========================================================================
// avatar.js — 나의 아바타 꾸미기
//  1) AvatarKit.svg(착용정보, 크기) : 아바타 그림(SVG)을 만들어 줍니다.
//  2) 아바타 꾸미기 화면(view-avatar): 입어 보기, 사기, 저장하기
//  3) 선생님: 아이템 가격·판매 여부 바꾸기
// 아이템 목록과 가격은 Code.gs의 AVATAR_ITEMS에 있습니다.
// 새 아이템을 넣으려면 Code.gs에 한 줄, 여기 DRAW에 그림 한 개를 추가하세요.
// ==========================================================================
(function () {
  'use strict';

  var INK = '#2B2B33';
  var SKIN = { sk_1: '#FFE0C7', sk_2: '#F5C9A0', sk_3: '#D9A273', sk_4: '#A8714A' };
  var BODY = 'M44 200 C46 160 66 142 100 140 C134 142 154 160 156 200 Z';
  var DEFAULT = { bg: 'bg_sky', skin: 'sk_1', hair: 'hr_short', top: 'tp_white', hat: 'hat_none', face: 'face_none', pet: 'pet_none' };
  var uidSeq = 0;

  function star(cx, cy, R, r) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var a = Math.PI / 5 * i - Math.PI / 2, rad = i % 2 ? r : R;
      pts.push((cx + rad * Math.cos(a)).toFixed(1) + ',' + (cy + rad * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
  }
  function heart(cx, cy, s) {
    return 'M' + cx + ' ' + (cy + 9 * s) +
      ' C' + (cx - 16 * s) + ' ' + (cy - 1 * s) + ' ' + (cx - 10 * s) + ' ' + (cy - 12 * s) + ' ' + cx + ' ' + (cy - 5 * s) +
      ' C' + (cx + 10 * s) + ' ' + (cy - 12 * s) + ' ' + (cx + 16 * s) + ' ' + (cy - 1 * s) + ' ' + cx + ' ' + (cy + 9 * s) + ' Z';
  }
  var O = ' stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"';

  // ---------- 그림: 배경 ----------
  var BG = {
    bg_sky: function () { return '<rect width="200" height="200" fill="#DCEBFF"/>'; },
    bg_mint: function () { return '<rect width="200" height="200" fill="#DAF4E6"/>'; },
    bg_cream: function () { return '<rect width="200" height="200" fill="#FFF1D2"/>'; },
    bg_dots: function () {
      var s = '<rect width="200" height="200" fill="#FFE1EA"/>';
      for (var y = 14; y < 200; y += 34) for (var x = (y / 34 % 2 ? 30 : 13); x < 200; x += 34) s += '<circle cx="' + x + '" cy="' + y + '" r="6" fill="#fff"/>';
      return s;
    },
    bg_class: function () {
      return '<rect width="200" height="200" fill="#F4E7D3"/>' +
        '<rect x="12" y="14" width="176" height="74" rx="6" fill="#A47148"/><rect x="18" y="20" width="164" height="62" rx="3" fill="#2F6B57"/>' +
        '<text x="30" y="44" font-size="15" fill="#fff" font-family="sans-serif" font-weight="700">1+1=2</text>' +
        '<path d="M140 36 l8 8 l14 -16" stroke="#FFE27A" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<rect x="0" y="176" width="200" height="24" fill="#D9B98C"/>';
    },
    bg_night: function () {
      var s = '<rect width="200" height="200" fill="#1F2B5C"/><circle cx="160" cy="36" r="16" fill="#FFE9A8"/><circle cx="168" cy="30" r="14" fill="#1F2B5C"/>';
      [[24, 30, 2.4], [52, 60, 1.6], [90, 22, 2], [130, 70, 1.6], [20, 110, 2], [180, 100, 2.2], [60, 150, 1.6], [176, 160, 1.8], [36, 180, 2]].forEach(function (p) {
        s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="#fff"/>';
      });
      return s + '<polygon points="' + star(112, 40, 6, 2.6) + '" fill="#FFE27A"/>';
    },
    bg_rainbow: function () {
      var c = ['#FF6B6B', '#FFA94D', '#FFE066', '#69DB7C', '#4DABF7', '#9775FA'], s = '<rect width="200" height="200" fill="#D3F0FF"/>';
      c.forEach(function (col, i) { s += '<path d="M' + (8 + i * 9) + ' 200 A' + (92 - i * 9) + ' ' + (92 - i * 9) + ' 0 0 1 ' + (192 - i * 9) + ' 200" stroke="' + col + '" stroke-width="9" fill="none"/>'; });
      return s + '<ellipse cx="40" cy="200" rx="70" ry="34" fill="#8CE99A"/><ellipse cx="170" cy="204" rx="70" ry="32" fill="#69DB7C"/>';
    },
    bg_palace: function (u) {
      return '<defs><linearGradient id="gp' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF0B3"/><stop offset="1" stop-color="#F2B630"/></linearGradient></defs>' +
        '<rect width="200" height="200" fill="url(#gp' + u + ')"/>' +
        '<rect x="14" y="40" width="18" height="160" fill="#FFF7D6" opacity=".8"/><rect x="168" y="40" width="18" height="160" fill="#FFF7D6" opacity=".8"/>' +
        '<rect x="8" y="30" width="30" height="12" fill="#E0A21C"/><rect x="162" y="30" width="30" height="12" fill="#E0A21C"/>' +
        '<path d="M70 200 L84 160 L116 160 L130 200 Z" fill="#D6336C"/>' +
        '<polygon points="' + star(100, 22, 9, 4) + '" fill="#fff" opacity=".9"/>';
    }
  };

  // ---------- 그림: 머리 (뒤쪽 back / 앞쪽 front) ----------
  var HAIR = {
    hr_short: { c: '#5B3A29', front: 'M56 92 C52 52 78 40 100 40 C124 40 150 52 144 92 C138 74 124 62 104 66 C90 58 70 70 56 92 Z' },
    hr_bob: {
      c: '#2E2A2A',
      back: 'M52 90 C50 50 76 38 100 38 C124 38 150 50 148 90 L150 128 C140 132 132 130 128 124 L72 124 C68 130 60 132 50 128 Z',
      front: 'M56 84 C58 52 80 42 100 42 C120 42 142 52 144 84 L132 80 L124 70 L114 78 L104 68 L94 78 L84 70 L76 80 Z'
    },
    hr_spiky: { c: '#3D2B1F', front: 'M54 90 L50 62 L66 66 L64 44 L82 54 L90 34 L102 52 L116 34 L120 54 L140 46 L136 66 L152 64 L146 90 C136 72 120 64 100 64 C80 64 64 72 54 90 Z' },
    hr_pony: {
      c: '#7A4A2A',
      back: 'M136 64 C176 60 184 120 162 146 C160 118 152 98 138 90 Z',
      front: 'M56 88 C54 52 80 42 100 42 C122 42 146 52 144 88 C132 70 118 64 100 66 C84 64 66 72 56 88 Z',
      extra: '<circle cx="140" cy="68" r="6" fill="#FF6B9A"' + O + '/>'
    },
    hr_twin: {
      c: '#FF7EB6',
      back: 'M54 74 C22 84 22 144 42 156 C42 128 50 106 62 94 Z M146 74 C178 84 178 144 158 156 C158 128 150 106 138 94 Z',
      front: 'M56 86 C58 52 80 42 100 42 C120 42 142 52 144 86 L132 78 L120 70 L110 78 L100 68 L90 78 L80 70 L68 78 Z',
      extra: '<path d="M48 70 l-12 -8 l0 18 Z M60 70 l12 -8 l0 18 Z" fill="#FFE066"' + O + '/><circle cx="54" cy="71" r="4" fill="#FFE066"' + O + '/>' +
        '<path d="M140 70 l-12 -8 l0 18 Z M152 70 l12 -8 l0 18 Z" fill="#FFE066"' + O + '/><circle cx="146" cy="71" r="4" fill="#FFE066"' + O + '/>'
    },
    hr_gold: {
      c: '#F4C542',
      back: 'M50 92 C46 46 76 34 100 34 C124 34 154 46 150 92 C158 112 150 128 156 146 C142 150 134 140 132 128 L68 128 C66 140 58 150 44 146 C50 128 42 112 50 92 Z',
      front: 'M54 90 C52 50 80 38 100 38 C126 38 150 52 146 90 C140 70 128 60 112 64 C116 72 108 78 98 70 C88 76 80 66 76 64 C64 70 58 78 54 90 Z',
      extra: '<path d="M80 48 Q90 44 98 50" stroke="#FFF3BF" stroke-width="3" fill="none" stroke-linecap="round"/>'
    },
    hr_rainbow: { c: 'rainbow', front: 'M54 92 C50 50 78 38 100 38 C124 38 152 50 146 92 C140 72 126 62 106 66 C90 58 68 70 54 92 Z' }
  };

  // ---------- 그림: 옷 (몸통 모양 안에 그림) ----------
  var TOP = {
    tp_white: function () { return { fill: '#F7F7F4', inner: '<path d="M88 141 L100 156 L112 141" fill="none" stroke="#D8D8D2" stroke-width="3"/>' }; },
    tp_gray: function () { return { fill: '#9AA3AE', inner: '<path d="M84 142 Q100 152 116 142" fill="none" stroke="#7D8794" stroke-width="5"/><rect x="40" y="188" width="120" height="12" fill="#86909C"/>' }; },
    tp_navy: function () { return { fill: '#34466B', inner: '<path d="M86 141 Q100 150 114 141" fill="none" stroke="#25344F" stroke-width="4"/>' }; },
    tp_stripe: function () {
      var s = ''; for (var y = 148; y < 200; y += 14) s += '<rect x="40" y="' + y + '" width="120" height="7" fill="#F0525F"/>';
      return { fill: '#FFFFFF', inner: s };
    },
    tp_hoodie: function () {
      return { fill: '#FFC93C', inner: '<path d="M70 146 Q100 168 130 146 Q122 140 100 142 Q78 140 70 146 Z" fill="#F2B21C"/>' +
        '<path d="M92 156 L90 180 M108 156 L110 180" stroke="#fff" stroke-width="3" stroke-linecap="round"/><rect x="74" y="182" width="52" height="18" rx="6" fill="#F2B21C"/>' };
    },
    tp_school: function () {
      return { fill: '#FFFFFF', inner: '<path d="M44 200 C46 166 60 150 80 144 L84 200 Z M156 200 C154 166 140 150 120 144 L116 200 Z" fill="#2E4A7D"/>' +
        '<path d="M88 141 L100 152 L112 141 L108 160 L100 154 L92 160 Z" fill="#fff" stroke="#D7DCE4" stroke-width="1.5"/>' +
        '<path d="M96 152 L104 152 L108 186 L100 196 L92 186 Z" fill="#E03131"/><rect x="96" y="150" width="8" height="6" fill="#C92A2A"/>' };
    },
    tp_soccer: function () {
      return { fill: '#1C7ED6', inner: '<path d="M60 150 L44 200 L56 200 L68 152 Z M140 150 L156 200 L144 200 L132 152 Z" fill="#fff"/>' +
        '<path d="M88 141 L100 152 L112 141" fill="none" stroke="#fff" stroke-width="4"/>' +
        '<text x="100" y="188" text-anchor="middle" font-size="26" font-weight="900" fill="#fff" font-family="sans-serif">10</text>' };
    },
    tp_suit: function () {
      return { fill: '#23252E', inner: '<path d="M84 141 L100 200 L116 141 Z" fill="#fff"/>' +
        '<path d="M84 141 L100 176 L90 182 L76 150 Z M116 141 L100 176 L110 182 L124 150 Z" fill="#363948"/>' +
        '<path d="M88 148 L100 154 L88 160 Z M112 148 L100 154 L112 160 Z" fill="#E03131"/><circle cx="100" cy="154" r="3.5" fill="#C92A2A"/>' +
        '<circle cx="100" cy="174" r="2" fill="#23252E"/><circle cx="100" cy="186" r="2" fill="#23252E"/>' };
    },
    tp_space: function () {
      return { fill: '#ECEFF3', inner: '<path d="M70 144 Q100 158 130 144 L132 152 Q100 168 68 152 Z" fill="#AEB7C2"/>' +
        '<rect x="80" y="166" width="40" height="26" rx="5" fill="#fff" stroke="#AEB7C2" stroke-width="2"/>' +
        '<circle cx="90" cy="179" r="4" fill="#FA5252"/><circle cx="102" cy="179" r="4" fill="#40C057"/><circle cx="114" cy="179" r="4" fill="#228BE6"/>' +
        '<circle cx="58" cy="176" r="8" fill="#FD7E14"/><polygon points="' + star(58, 176, 5, 2.2) + '" fill="#fff"/>' };
    },
    tp_king: function () {
      var dots = ''; [[70, 152], [86, 158], [114, 158], [130, 152], [100, 160]].forEach(function (p) { dots += '<rect x="' + (p[0] - 1.5) + '" y="' + (p[1] - 3) + '" width="3" height="6" fill="' + INK + '"/>'; });
      return { fill: '#C92A2A', inner: '<path d="M90 160 L100 200 L110 160 Z" fill="#FFD43B"/>' +
        '<path d="M58 152 Q100 172 142 152 Q138 140 100 140 Q62 140 58 152 Z" fill="#fff"/>' + dots +
        '<path d="M76 166 Q100 184 124 166" fill="none" stroke="#FFD43B" stroke-width="4"/><circle cx="100" cy="180" r="6" fill="#FFD43B" stroke="#E0A21C" stroke-width="2"/>' };
    },
    tp_gold: function (u) {
      return { fill: 'url(#gt' + u + ')', defs: '<linearGradient id="gt' + u + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE58F"/><stop offset=".5" stop-color="#F2B630"/><stop offset="1" stop-color="#FFE58F"/></linearGradient>',
        inner: '<path d="M84 141 L100 200 L116 141 Z" fill="#fff"/>' +
        '<path d="M84 141 L100 176 L90 182 L76 150 Z M116 141 L100 176 L110 182 L124 150 Z" fill="#E0A21C"/>' +
        '<path d="M88 148 L100 154 L88 160 Z M112 148 L100 154 L112 160 Z" fill="' + INK + '"/><circle cx="100" cy="154" r="3.5" fill="' + INK + '"/>' +
        '<path d="M60 168 L66 160 M136 166 L142 174" stroke="#FFF8DB" stroke-width="3" stroke-linecap="round"/>' };
    }
  };

  // ---------- 그림: 모자 ----------
  var HAT = {
    hat_none: function () { return ''; },
    hat_cap: function () {
      return '<path d="M54 80 C52 38 148 38 146 80 Z" fill="#E03131"' + O + '/><path d="M48 80 Q100 94 152 80 L154 88 Q100 104 46 88 Z" fill="#C92A2A"' + O + '/>' +
        '<circle cx="100" cy="44" r="4" fill="#C92A2A"/><rect x="88" y="56" width="24" height="12" rx="3" fill="#fff"/>';
    },
    hat_ribbon: function () {
      return '<path d="M58 72 Q100 34 142 72" stroke="#FF6B9A" stroke-width="7" fill="none" stroke-linecap="round"/>' +
        '<path d="M126 50 L108 38 L110 62 Z M126 50 L144 38 L142 62 Z" fill="#FF6B9A"' + O + '/><circle cx="126" cy="50" r="5" fill="#FF8FB1"' + O + '/>';
    },
    hat_beanie: function () {
      return '<path d="M56 76 C56 34 144 34 144 76 Z" fill="#37B24D"' + O + '/><rect x="52" y="66" width="96" height="16" rx="7" fill="#2F9E44"' + O + '/>' +
        '<path d="M70 70 V80 M84 70 V80 M98 70 V80 M112 70 V80 M126 70 V80" stroke="#2B8A3E" stroke-width="2.5"/>' +
        '<circle cx="100" cy="32" r="10" fill="#fff"' + O + '/>';
    },
    hat_straw: function () {
      return '<ellipse cx="100" cy="66" rx="68" ry="14" fill="#F2CC6B"' + O + '/><path d="M64 66 C64 28 136 28 136 66 Z" fill="#F7D985"' + O + '/>' +
        '<path d="M65 56 Q100 62 135 56 L136 64 Q100 70 64 64 Z" fill="#E8590C"/>';
    },
    hat_wizard: function () {
      return '<path d="M62 68 L106 0 L138 68 Z" fill="#6741D9"' + O + '/><ellipse cx="100" cy="68" rx="54" ry="11" fill="#5F3DC4"' + O + '/>' +
        '<polygon points="' + star(98, 40, 7, 3) + '" fill="#FFE066"/><polygon points="' + star(116, 22, 4.5, 2) + '" fill="#FFE066"/><circle cx="84" cy="56" r="2.5" fill="#FFE066"/>';
    },
    hat_crown: function () {
      return '<path d="M60 64 L58 30 L80 46 L100 20 L120 46 L142 30 L140 64 Z" fill="#FFD43B"' + O + '/>' +
        '<rect x="58" y="56" width="84" height="14" rx="4" fill="#FAB005"' + O + '/>' +
        '<circle cx="100" cy="63" r="5" fill="#E03131"/><circle cx="78" cy="63" r="4" fill="#228BE6"/><circle cx="122" cy="63" r="4" fill="#40C057"/>' +
        '<circle cx="58" cy="30" r="4" fill="#FFE066"' + O + '/><circle cx="100" cy="20" r="4" fill="#FFE066"' + O + '/><circle cx="142" cy="30" r="4" fill="#FFE066"' + O + '/>';
    }
  };

  // ---------- 그림: 안경·얼굴 ----------
  var FACE = {
    face_none: function () { return ''; },
    face_round: function () {
      return '<g fill="#fff" fill-opacity=".18" stroke="' + INK + '" stroke-width="3"><circle cx="83" cy="96" r="12"/><circle cx="117" cy="96" r="12"/></g>' +
        '<path d="M95 95 Q100 91 105 95 M71 94 L58 90 M129 94 L142 90" stroke="' + INK + '" stroke-width="3" fill="none"/>';
    },
    face_sun: function () {
      return '<rect x="68" y="87" width="28" height="18" rx="7" fill="#1D1D25"/><rect x="104" y="87" width="28" height="18" rx="7" fill="#1D1D25"/>' +
        '<path d="M96 93 L104 93 M68 92 L58 89 M132 92 L142 89" stroke="#1D1D25" stroke-width="3"/>' +
        '<path d="M73 92 L80 92 M109 92 L116 92" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>';
    },
    face_heart: function () {
      return '<path d="' + heart(83, 96, 1) + '" fill="#FF4D6D" fill-opacity=".85" stroke="#C9184A" stroke-width="2"/>' +
        '<path d="' + heart(117, 96, 1) + '" fill="#FF4D6D" fill-opacity=".85" stroke="#C9184A" stroke-width="2"/>' +
        '<path d="M96 92 L104 92 M70 92 L58 89 M130 92 L142 89" stroke="#C9184A" stroke-width="3"/>';
    },
    face_mono: function () {
      return '<circle cx="117" cy="96" r="12" fill="#fff" fill-opacity=".2" stroke="#E0A21C" stroke-width="3.5"/>' +
        '<path d="M126 104 Q140 120 134 140" stroke="#E0A21C" stroke-width="2" fill="none"/>' +
        '<path d="M86 108 Q93 102 100 107 Q107 102 114 108 Q107 112 100 110 Q93 112 86 108 Z" fill="#4A3426"/>';
    },
    face_star: function () {
      return '<polygon points="' + star(83, 96, 16, 8) + '" fill="#1D1D25" stroke="#FFD43B" stroke-width="3"/>' +
        '<polygon points="' + star(117, 96, 16, 8) + '" fill="#1D1D25" stroke="#FFD43B" stroke-width="3"/>' +
        '<path d="M97 96 L103 96 M68 94 L58 90 M132 94 L142 90" stroke="#FFD43B" stroke-width="3"/>';
    }
  };

  // ---------- 그림: 펫 (오른쪽 아래) ----------
  var PET = {
    pet_none: function () { return ''; },
    pet_chick: function () {
      return '<ellipse cx="170" cy="182" rx="18" ry="16" fill="#FFE066"' + O + '/><path d="M178 182 Q186 178 184 188" fill="#FCC419" stroke="' + INK + '" stroke-width="2"/>' +
        '<circle cx="164" cy="177" r="2.6" fill="' + INK + '"/><circle cx="176" cy="177" r="2.6" fill="' + INK + '"/>' +
        '<path d="M166 183 L170 189 L174 183 Z" fill="#FD7E14" stroke="' + INK + '" stroke-width="1.5"/><path d="M168 166 Q170 160 174 166" stroke="' + INK + '" stroke-width="2" fill="none"/>';
    },
    pet_cat: function () {
      return '<path d="M154 168 L156 150 L168 162 Z M186 168 L184 150 L172 162 Z" fill="#FFA94D"' + O + '/><circle cx="170" cy="178" r="19" fill="#FFA94D"' + O + '/>' +
        '<path d="M162 162 L166 170 M170 160 V168 M178 162 L174 170" stroke="#E8590C" stroke-width="2.5" stroke-linecap="round"/>' +
        '<circle cx="163" cy="178" r="2.6" fill="' + INK + '"/><circle cx="177" cy="178" r="2.6" fill="' + INK + '"/>' +
        '<path d="M168 184 L172 184 L170 187 Z" fill="#FF8FA3"/><path d="M150 184 L160 185 M150 190 L160 188 M190 184 L180 185 M190 190 L180 188" stroke="' + INK + '" stroke-width="1.4"/>';
    },
    pet_dog: function () {
      return '<circle cx="170" cy="178" r="19" fill="#E9C79A"' + O + '/><ellipse cx="152" cy="176" rx="7" ry="13" fill="#9C6B3E"' + O + '/><ellipse cx="188" cy="176" rx="7" ry="13" fill="#9C6B3E"' + O + '/>' +
        '<circle cx="163" cy="175" r="2.6" fill="' + INK + '"/><circle cx="177" cy="175" r="2.6" fill="' + INK + '"/>' +
        '<ellipse cx="170" cy="183" rx="4" ry="3" fill="' + INK + '"/><path d="M167 188 Q170 194 173 188" fill="#FF6B81" stroke="' + INK + '" stroke-width="1.4"/>';
    },
    pet_dragon: function () {
      return '<path d="M150 170 L134 152 L146 176 Z M190 170 L198 150 L192 178 Z" fill="#B197FC"' + O + '/>' +
        '<circle cx="170" cy="178" r="20" fill="#51CF66"' + O + '/><ellipse cx="170" cy="188" rx="11" ry="8" fill="#D3F9D8"/>' +
        '<path d="M158 160 L156 148 L164 158 Z M182 160 L184 148 L176 158 Z" fill="#FFD43B"' + O + '/>' +
        '<circle cx="163" cy="174" r="3.4" fill="#fff"/><circle cx="177" cy="174" r="3.4" fill="#fff"/><circle cx="163.6" cy="174.6" r="2" fill="' + INK + '"/><circle cx="177.6" cy="174.6" r="2" fill="' + INK + '"/>' +
        '<path d="M164 184 Q170 188 176 184" stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    }
  };

  function hairFill(h, u) { return h.c === 'rainbow' ? 'url(#hr' + u + ')' : h.c; }

  function svg(eq, size, extraClass) {
    eq = eq || {};
    var e = {};
    Object.keys(DEFAULT).forEach(function (k) { e[k] = eq[k] || DEFAULT[k]; });
    var u = ++uidSeq;
    var skin = SKIN[e.skin] || SKIN.sk_1;
    var hair = HAIR[e.hair] || HAIR.hr_short;
    var top = (TOP[e.top] || TOP.tp_white)(u);
    var hf = hairFill(hair, u);
    var defs = '<clipPath id="cb' + u + '"><path d="' + BODY + '"/></clipPath>' + (top.defs || '');
    if (hair.c === 'rainbow') {
      defs += '<linearGradient id="hr' + u + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF6B6B"/><stop offset=".25" stop-color="#FFD43B"/>' +
        '<stop offset=".5" stop-color="#51CF66"/><stop offset=".75" stop-color="#339AF0"/><stop offset="1" stop-color="#9775FA"/></linearGradient>';
    }
    var s = '<svg class="av-svg ' + (extraClass || '') + '" viewBox="0 0 200 200" width="' + (size || 120) + '" height="' + (size || 120) + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="아바타">' +
      '<defs>' + defs + '</defs>' +
      (BG[e.bg] || BG.bg_sky)(u) +
      (hair.back ? '<path d="' + hair.back + '" fill="' + hf + '"' + O + '/>' : '') +
      // 몸통(옷)
      '<g clip-path="url(#cb' + u + ')"><path d="' + BODY + '" fill="' + top.fill + '"/>' + (top.inner || '') + '</g>' +
      '<path d="' + BODY + '" fill="none"' + O + '/>' +
      // 목·귀·얼굴
      '<path d="M88 124 L88 140 Q100 146 112 140 L112 124 Z" fill="' + skin + '"' + O + '/>' +
      '<circle cx="57" cy="96" r="9" fill="' + skin + '"' + O + '/><circle cx="143" cy="96" r="9" fill="' + skin + '"' + O + '/>' +
      '<circle cx="100" cy="90" r="44" fill="' + skin + '"' + O + '/>' +
      '<ellipse cx="74" cy="108" rx="7" ry="4.5" fill="#FF8FA3" opacity=".5"/><ellipse cx="126" cy="108" rx="7" ry="4.5" fill="#FF8FA3" opacity=".5"/>' +
      '<ellipse cx="84" cy="96" rx="5" ry="6.5" fill="' + INK + '"/><ellipse cx="116" cy="96" rx="5" ry="6.5" fill="' + INK + '"/>' +
      '<circle cx="86" cy="93" r="1.8" fill="#fff"/><circle cx="118" cy="93" r="1.8" fill="#fff"/>' +
      '<path d="M93 112 Q100 119 107 112" stroke="' + INK + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      // 머리 앞쪽
      '<path d="' + hair.front + '" fill="' + hf + '"' + O + '/>' + (hair.extra || '') +
      (FACE[e.face] || FACE.face_none)(u) +
      (HAT[e.hat] || HAT.hat_none)(u) +
      (PET[e.pet] || PET.pet_none)(u) +
      '</svg>';
    return s;
  }

  window.AvatarKit = { svg: svg, DEFAULT: DEFAULT };

  // ======================================================================
  // 화면
  // ======================================================================
  var SLOT_LABEL = { bg: '배경', skin: '피부색', hair: '머리', top: '옷', hat: '모자', face: '안경', pet: '펫' };
  var SLOT_ICON = { bg: 'fa-image', skin: 'fa-hand', hair: 'fa-scissors', top: 'fa-shirt', hat: 'fa-hat-cowboy', face: 'fa-glasses', pet: 'fa-paw' };
  var st = { cc: '', sno: '', items: [], byId: {}, slots: [], owned: [], saved: {}, draft: {}, card: 0, slot: 'top', pick: null, name: '' };
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return Number(n || 0).toLocaleString() + ' 머니'; }
  function toast(m) { if (typeof window.showToast === 'function') window.showToast(m); else alert(m); }
  function call(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (ok, no) {
      var r = google.script.run.withSuccessHandler(ok).withFailureHandler(no);
      r[fn].apply(r, args);
    });
  }
  function rarity(p) {
    if (p <= 0) return { t: '기본', c: 'r0' };
    if (p <= 100) return { t: '일반', c: 'r1' };
    if (p <= 400) return { t: '고급', c: 'r2' };
    if (p <= 1000) return { t: '희귀', c: 'r3' };
    return { t: '전설', c: 'r4' };
  }
  function isFree(it) { return it.price <= 0; }
  function isOwned(id) { return st.owned.indexOf(id) >= 0; }
  function canWear(it) { return isFree(it) || isOwned(it.id); }
  function who() {
    var cc = window._cc || window._adminCC || '';
    var sno = typeof window.buyerSno === 'function' ? window.buyerSno() : (window._sno || '');
    return { cc: cc, sno: sno };
  }

  window.openAvatar = function () {
    var w = who();
    if (!w.cc || !w.sno) return toast('⚠️ 로그인한 뒤 이용할 수 있어요.');
    st.cc = w.cc; st.sno = w.sno;
    if (typeof window.showLoading === 'function') window.showLoading();
    Promise.all([call('getAvatarShop', w.cc), call('getMyAvatar', w.cc, w.sno)]).then(function (r) {
      if (typeof window.hideLoading === 'function') window.hideLoading();
      if (!r[0].success) return toast('⚠️ ' + r[0].msg);
      if (!r[1].success) return toast('⚠️ ' + r[1].msg);
      st.items = r[0].items; st.slots = r[0].slots; st.byId = {};
      st.items.forEach(function (it) { st.byId[it.id] = it; });
      st.owned = r[1].owned || []; st.saved = r[1].equipped; st.draft = JSON.parse(JSON.stringify(r[1].equipped));
      st.card = r[1].card; st.name = r[1].name; st.pick = null;
      $('av-admin').style.display = 'none';
      $('av-admin-btn').style.display = window._isTeacher ? 'inline-flex' : 'none';
      renderAll();
      window.go('view-avatar');
    }).catch(function (e) {
      if (typeof window.hideLoading === 'function') window.hideLoading();
      toast('⚠️ ' + (e && e.message || e));
    });
  };

  function renderAll() { renderPreview(); renderTabs(); renderItems(); }

  function unpaidInDraft() {
    var list = [];
    st.slots.forEach(function (s) { var it = st.byId[st.draft[s]]; if (it && !canWear(it)) list.push(it); });
    return list;
  }

  function renderPreview() {
    $('av-preview').innerHTML = svg(st.draft, 240, 'av-big');
    $('av-owner').textContent = (st.name || (st.sno + '번')) + (st.sno === '0' ? ' (선생님)' : '');
    $('av-card').textContent = money(st.card);
    var unpaid = unpaidInDraft(), box = $('av-status');
    var changed = JSON.stringify(st.draft) !== JSON.stringify(st.saved);
    if (unpaid.length) {
      var total = unpaid.reduce(function (a, it) { return a + it.price; }, 0);
      box.innerHTML = '<div class="av-note warn">👀 입어 보는 중: <b>' + unpaid.map(function (it) { return esc(it.name); }).join(', ') + '</b><br>저장하려면 먼저 사야 해요. (합계 ' + money(total) + ')</div>';
    } else if (changed) {
      box.innerHTML = '<div class="av-note">바뀐 모습을 저장하려면 <b>저장하기</b>를 눌러 주세요.</div>';
    } else box.innerHTML = '';
    $('av-save').disabled = !changed || unpaid.length > 0;
  }

  function renderTabs() {
    $('av-tabs').innerHTML = st.slots.map(function (s) {
      return '<button class="av-tab' + (s === st.slot ? ' act' : '') + '" onclick="avatarSlot(\'' + s + '\')"><i class="fa-solid ' + SLOT_ICON[s] + '"></i> ' + SLOT_LABEL[s] + '</button>';
    }).join('');
  }

  function renderItems() {
    var list = st.items.filter(function (it) { return it.slot === st.slot && (it.onSale || isOwned(it.id) || isFree(it)); });
    list.sort(function (a, b) { return a.price - b.price; });
    $('av-items').innerHTML = list.map(function (it) {
      var trial = JSON.parse(JSON.stringify(st.draft)); trial[it.slot] = it.id;
      var rr = rarity(it.price), on = st.draft[it.slot] === it.id;
      var state;
      if (isFree(it)) state = '<span class="av-price free">무료</span>';
      else if (isOwned(it.id)) state = '<span class="av-price own"><i class="fa-solid fa-check"></i> 보유</span>';
      else state = '<button class="av-buy" onclick="event.stopPropagation();avatarBuy(\'' + it.id + '\')"><i class="fa-solid fa-coins"></i> ' + money(it.price) + '</button>';
      return '<div class="av-item ' + rr.c + (on ? ' on' : '') + '" onclick="avatarTry(\'' + it.id + '\')">' +
        '<span class="av-rare ' + rr.c + '">' + rr.t + '</span>' +
        '<div class="av-thumb">' + svg(trial, 96) + '</div>' +
        '<div class="av-name">' + esc(it.name) + '</div>' + state + '</div>';
    }).join('') || '<div class="empty-msg">판매 중인 아이템이 없어요.</div>';
  }

  window.avatarSlot = function (s) { st.slot = s; renderTabs(); renderItems(); };
  window.avatarTry = function (id) {
    var it = st.byId[id]; if (!it) return;
    st.draft[it.slot] = id; renderPreview(); renderItems();
  };
  window.avatarReset = function () { st.draft = JSON.parse(JSON.stringify(st.saved)); renderPreview(); renderItems(); };

  window.avatarBuy = function (id) {
    var it = st.byId[id]; if (!it) return;
    if (!confirm('[아바타 아이템 구매]\n\n' + it.name + '\n가격: ' + money(it.price) + '\n내 카드 잔액: ' + money(st.card) + '\n\n살까요?')) return;
    call('buyAvatarItem', st.cc, st.sno, id).then(function (r) {
      if (!r.success) return alert(r.msg);
      st.owned = r.owned; st.card = r.newCard;
      st.draft[it.slot] = id;
      toast('🎉 ' + r.msg + ' 저장하기를 누르면 입혀져요.');
      renderPreview(); renderItems();
    }).catch(function (e) { alert('오류: ' + (e && e.message || e)); });
  };

  window.avatarSave = function () {
    call('saveAvatar', st.cc, st.sno, JSON.stringify(st.draft)).then(function (r) {
      if (!r.success) return alert(r.msg);
      st.saved = r.equipped; st.draft = JSON.parse(JSON.stringify(r.equipped));
      toast('✅ ' + r.msg);
      renderPreview(); renderItems(); refreshDashAvatar();
    }).catch(function (e) { alert('오류: ' + (e && e.message || e)); });
  };

  // ---------- 선생님: 가격 관리 ----------
  window.avatarAdminToggle = function () {
    var box = $('av-admin');
    if (box.style.display === 'block') { box.style.display = 'none'; return; }
    box.style.display = 'block';
    var rows = st.slots.map(function (s) {
      return st.items.filter(function (it) { return it.slot === s; }).map(function (it) {
        return '<tr><td>' + SLOT_LABEL[s] + '</td><td>' + esc(it.name) + '</td><td>' + money(it.basePrice) + '</td>' +
          '<td><input type="number" min="0" step="10" class="av-adm-price" data-id="' + it.id + '" value="' + it.price + '" style="width:110px;"></td>' +
          '<td style="text-align:center;"><input type="checkbox" class="av-adm-sale" data-id="' + it.id + '"' + (it.onSale ? ' checked' : '') + ' style="width:18px;height:18px;"></td></tr>';
      }).join('');
    }).join('');
    $('av-admin-body').innerHTML = rows;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  window.avatarAdminSave = function () {
    var changes = [];
    document.querySelectorAll('.av-adm-price').forEach(function (inp) {
      var id = inp.dataset.id, sale = document.querySelector('.av-adm-sale[data-id="' + id + '"]');
      changes.push({ id: id, price: Number(inp.value), onSale: sale ? sale.checked : true });
    });
    call('setAvatarPrices', st.cc, JSON.stringify(changes)).then(function (r) {
      if (!r.success) return alert(r.msg);
      toast('✅ ' + r.msg);
      window.openAvatar();
    }).catch(function (e) { alert('오류: ' + (e && e.message || e)); });
  };

  // ---------- 대시보드 위 작은 아바타 ----------
  function refreshDashAvatar() {
    var box = $('dash-avatar'); if (!box) return;
    var w = who();
    if (!w.cc || !w.sno) { box.innerHTML = svg(DEFAULT, 56); return; }
    call('getMyAvatar', w.cc, w.sno).then(function (r) {
      if (r && r.success) box.innerHTML = svg(r.equipped, 56);
    }).catch(function () {});
  }
  window.refreshDashAvatar = refreshDashAvatar;

  // ---------- 학생 명단의 작은 아바타 ----------
  window.fillListAvatars = function (cc) {
    if (!cc) return;
    call('getClassAvatars', cc).then(function (r) {
      if (!r || !r.success) return;
      document.querySelectorAll('[data-av-sno]').forEach(function (el) {
        el.innerHTML = svg(r.map[el.getAttribute('data-av-sno')] || r.defaults, 34);
      });
    }).catch(function () {});
  };
})();
