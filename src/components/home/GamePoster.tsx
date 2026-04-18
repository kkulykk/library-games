import { Fragment, type CSSProperties, type ReactElement } from 'react'

type PosterComponent = () => ReactElement

const svgStyle: CSSProperties = { width: '100%', height: '100%' }

const Posters: Record<string, PosterComponent> = {
  wordle: () => {
    const rows = ['GHOST', 'FLAME', 'ARCDE']
    const states = [
      [0, 2, 0, 0, 1],
      [0, 0, 2, 1, 0],
      [2, 2, 2, 2, 2],
    ]
    const colorFor = (s: number) => (s === 2 ? '#bfff3a' : s === 1 ? '#e6c12b' : '#1a1a18')
    return (
      <svg viewBox="0 0 300 200" style={svgStyle}>
        {rows.map((row, r) =>
          row.split('').map((ch, c) => (
            <g key={`${r}-${c}`} transform={`translate(${20 + c * 52}, ${20 + r * 52})`}>
              <rect
                width="48"
                height="48"
                fill={colorFor(states[r][c])}
                stroke={states[r][c] === 0 ? '#2a2a27' : 'none'}
                strokeWidth="1.5"
                rx="2"
              />
              <text
                x="24"
                y="32"
                textAnchor="middle"
                fontFamily="'Space Grotesk', sans-serif"
                fontWeight="700"
                fontSize="22"
                fill={states[r][c] === 0 ? '#e8e6dd' : '#0a0a08'}
              >
                {ch}
              </text>
            </g>
          ))
        )}
      </svg>
    )
  },

  minesweeper: () => {
    const data: (number | '*')[][] = [
      [1, 1, 2, '*', 2, 1, 0, 0],
      [1, '*', 2, 2, '*', 1, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 1, '*', 1],
    ]
    const numColors = ['#0a0a08', '#2d6bff', '#1f9b4a', '#ff4d3a', '#6a3fff']
    return (
      <svg viewBox="0 0 320 160" style={svgStyle}>
        {data.map((row, r) =>
          row.map((v, c) => (
            <g key={`${r}-${c}`} transform={`translate(${c * 38 + 8}, ${r * 38 + 8})`}>
              <rect
                width="34"
                height="34"
                fill={v === '*' ? '#ff4d3a' : '#e8e6dd'}
                stroke="#0a0a08"
                strokeWidth="1.5"
              />
              {v === '*' ? (
                <circle cx="17" cy="17" r="7" fill="#0a0a08" />
              ) : typeof v === 'number' && v > 0 ? (
                <text
                  x="17"
                  y="24"
                  textAnchor="middle"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="700"
                  fontSize="18"
                  fill={numColors[v]}
                >
                  {v}
                </text>
              ) : null}
            </g>
          ))
        )}
      </svg>
    )
  },

  '2048': () => {
    const tiles: (number | null)[][] = [
      [2, 4, 8, null],
      [4, 16, null, 2],
      [null, 32, 64, 128],
      [null, null, 256, 2048],
    ]
    const bg: Record<number, string> = {
      2: '#ede4d6',
      4: '#ecdec1',
      8: '#f2b179',
      16: '#f59563',
      32: '#f67c5f',
      64: '#f65e3b',
      128: '#edcf72',
      256: '#edcc61',
      512: '#edc850',
      1024: '#edc53f',
      2048: '#bfff3a',
    }
    return (
      <svg viewBox="0 0 240 240" style={svgStyle}>
        <rect width="240" height="240" fill="#1a1a18" rx="4" />
        {tiles.flat().map((v, i) => {
          const r = Math.floor(i / 4)
          const c = i % 4
          return (
            <g key={i} transform={`translate(${c * 56 + 12}, ${r * 56 + 12})`}>
              <rect width="52" height="52" fill={v ? bg[v] || '#bfff3a' : '#2a2a27'} rx="3" />
              {v && (
                <text
                  x="26"
                  y={v >= 128 ? 32 : 34}
                  textAnchor="middle"
                  fontFamily="'Space Grotesk', sans-serif"
                  fontWeight="800"
                  fontSize={v >= 1024 ? 14 : v >= 128 ? 16 : 22}
                  fill={v >= 8 ? '#0a0a08' : '#6f6658'}
                >
                  {v}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    )
  },

  sudoku: () => {
    const grid: (number | '.')[][] = [
      [5, 3, '.', '.', 7, '.', '.', '.', '.'],
      [6, '.', '.', 1, 9, 5, '.', '.', '.'],
      ['.', 9, 8, '.', '.', '.', '.', 6, '.'],
      [8, '.', '.', '.', 6, '.', '.', '.', 3],
      [4, '.', '.', 8, '.', 3, '.', '.', 1],
      [7, '.', '.', '.', 2, '.', '.', '.', 6],
      ['.', 6, '.', '.', '.', '.', 2, 8, '.'],
      ['.', '.', '.', 4, 1, 9, '.', '.', 5],
      ['.', '.', '.', '.', 8, '.', '.', 7, 9],
    ]
    return (
      <svg viewBox="0 0 270 270" style={svgStyle}>
        <rect width="270" height="270" fill="#e8e6dd" />
        {grid.flat().map((v, i) => {
          const r = Math.floor(i / 9)
          const c = i % 9
          return v !== '.' ? (
            <text
              key={i}
              x={c * 30 + 15}
              y={r * 30 + 20}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="700"
              fontSize="16"
              fill="#0a0a08"
            >
              {v}
            </text>
          ) : null
        })}
        {Array.from({ length: 10 }).map((_, i) => (
          <Fragment key={i}>
            <line
              x1={i * 30}
              y1="0"
              x2={i * 30}
              y2="270"
              stroke={i % 3 === 0 ? '#0a0a08' : '#b5b0a1'}
              strokeWidth={i % 3 === 0 ? 2 : 1}
            />
            <line
              x1="0"
              y1={i * 30}
              x2="270"
              y2={i * 30}
              stroke={i % 3 === 0 ? '#0a0a08' : '#b5b0a1'}
              strokeWidth={i % 3 === 0 ? 2 : 1}
            />
          </Fragment>
        ))}
      </svg>
    )
  },

  memory: () => {
    const layout = [
      ['♠', '?', '?', '♥'],
      ['?', '★', '?', '?'],
      ['?', '?', '♣', '?'],
      ['♦', '?', '?', '★'],
    ]
    return (
      <svg viewBox="0 0 260 260" style={svgStyle}>
        {layout.flat().map((s, i) => {
          const r = Math.floor(i / 4)
          const c = i % 4
          const flipped = s !== '?'
          return (
            <g key={i} transform={`translate(${c * 60 + 15}, ${r * 60 + 15})`}>
              <rect
                width="50"
                height="50"
                fill={flipped ? '#e8e6dd' : '#6a3fff'}
                stroke="#0a0a08"
                strokeWidth="1.5"
                rx="6"
              />
              <text
                x="25"
                y="34"
                textAnchor="middle"
                fontFamily="serif"
                fontWeight="700"
                fontSize="26"
                fill={flipped ? '#0a0a08' : '#e8e6dd'}
              >
                {flipped ? s : '◈'}
              </text>
            </g>
          )
        })}
      </svg>
    )
  },

  snake: () => {
    const segs: [number, number][] = [
      [4, 3],
      [5, 3],
      [6, 3],
      [7, 3],
      [7, 4],
      [7, 5],
      [8, 5],
      [9, 5],
      [10, 5],
      [10, 6],
      [10, 7],
    ]
    const food: [number, number] = [3, 8]
    return (
      <svg viewBox="0 0 240 180" style={svgStyle}>
        <rect width="240" height="180" fill="#0a0a08" />
        {Array.from({ length: 12 * 9 }).map((_, i) => {
          const c = i % 12
          const r = Math.floor(i / 12)
          return (
            <rect
              key={i}
              x={c * 20}
              y={r * 20}
              width="20"
              height="20"
              fill="none"
              stroke="#141412"
              strokeWidth="1"
            />
          )
        })}
        {segs.map(([c, r], i) => (
          <rect
            key={i}
            x={c * 20 + 2}
            y={r * 20 + 2}
            width="16"
            height="16"
            fill="#bfff3a"
            rx="1"
            opacity={0.5 + (i / segs.length) * 0.5}
          />
        ))}
        <circle cx={food[0] * 20 + 10} cy={food[1] * 20 + 10} r="6" fill="#ff4d3a" />
      </svg>
    )
  },

  tetris: () => {
    const pieces = [
      { shape: [[1, 1, 1, 1]], color: '#00d4ff', x: 0, y: 14 },
      {
        shape: [
          [1, 1],
          [1, 1],
        ],
        color: '#f5d800',
        x: 4,
        y: 14,
      },
      {
        shape: [
          [0, 1, 0],
          [1, 1, 1],
        ],
        color: '#a855f7',
        x: 7,
        y: 14,
      },
      {
        shape: [
          [1, 0, 0],
          [1, 1, 1],
        ],
        color: '#2563eb',
        x: 1,
        y: 12,
      },
      {
        shape: [
          [0, 1, 1],
          [1, 1, 0],
        ],
        color: '#22c55e',
        x: 6,
        y: 12,
      },
    ]
    return (
      <svg viewBox="0 0 200 300" style={svgStyle}>
        <rect width="200" height="300" fill="#0a0a08" />
        {Array.from({ length: 10 * 15 }).map((_, i) => {
          const c = i % 10
          const r = Math.floor(i / 10)
          return (
            <rect
              key={i}
              x={c * 20}
              y={r * 20}
              width="20"
              height="20"
              fill="none"
              stroke="#141412"
              strokeWidth="0.5"
            />
          )
        })}
        {pieces.map((p, pi) =>
          p.shape.map((row, r) =>
            row.map((v, c) =>
              v ? (
                <rect
                  key={`${pi}-${r}-${c}`}
                  x={(p.x + c) * 20 + 1}
                  y={(p.y + r) * 20 + 1}
                  width="18"
                  height="18"
                  fill={p.color}
                  rx="1"
                />
              ) : null
            )
          )
        )}
      </svg>
    )
  },

  breakout: () => {
    const rows = 5
    const cols = 10
    const colors = ['#ff4d3a', '#ff8c2a', '#f5d800', '#7dff5a', '#2563eb']
    return (
      <svg viewBox="0 0 320 240" style={svgStyle}>
        <rect width="320" height="240" fill="#0a0a08" />
        {Array.from({ length: rows * cols }).map((_, i) => {
          const c = i % cols
          const r = Math.floor(i / cols)
          if ((r === 0 && c === 3) || (r === 1 && c === 7) || (r === 2 && c === 2)) return null
          return (
            <rect key={i} x={c * 30 + 12} y={r * 14 + 20} width="26" height="10" fill={colors[r]} />
          )
        })}
        <rect x="130" y="205" width="60" height="6" fill="#e8e6dd" rx="2" />
        <circle cx="155" cy="160" r="5" fill="#e8e6dd" />
      </svg>
    )
  },

  hangman: () => (
    <svg viewBox="0 0 280 200" style={svgStyle}>
      <line x1="20" y1="180" x2="140" y2="180" stroke="#0a0a08" strokeWidth="4" />
      <line x1="50" y1="180" x2="50" y2="20" stroke="#0a0a08" strokeWidth="4" />
      <line x1="50" y1="20" x2="120" y2="20" stroke="#0a0a08" strokeWidth="4" />
      <line x1="120" y1="20" x2="120" y2="45" stroke="#0a0a08" strokeWidth="4" />
      <circle cx="120" cy="60" r="15" fill="none" stroke="#0a0a08" strokeWidth="4" />
      <line x1="120" y1="75" x2="120" y2="120" stroke="#0a0a08" strokeWidth="4" />
      <line x1="120" y1="90" x2="100" y2="105" stroke="#0a0a08" strokeWidth="4" />
      <line x1="120" y1="90" x2="140" y2="105" stroke="#0a0a08" strokeWidth="4" />
      {['G', '_', 'O', '_', 'T'].map((ch, i) => (
        <g key={i} transform={`translate(${165 + i * 22}, 150)`}>
          <line x1="0" y1="20" x2="16" y2="20" stroke="#0a0a08" strokeWidth="3" />
          {ch !== '_' && (
            <text
              x="8"
              y="16"
              textAnchor="middle"
              fontFamily="'Space Grotesk', sans-serif"
              fontWeight="800"
              fontSize="18"
              fill="#0a0a08"
            >
              {ch}
            </text>
          )}
        </g>
      ))}
    </svg>
  ),

  bounce: () => (
    <svg viewBox="0 0 320 200" style={svgStyle}>
      <rect width="320" height="200" fill="#0a0a08" />
      {Array.from({ length: 20 }).map((_, i) => (
        <rect
          key={i}
          x={i * 16}
          y={180}
          width="14"
          height="14"
          fill={i % 3 === 0 ? '#4a3820' : '#3a2a18'}
        />
      ))}
      {(
        [
          [0, 120],
          [1, 120],
          [4, 100],
          [5, 100],
          [6, 100],
          [10, 130],
          [11, 130],
          [15, 90],
          [16, 90],
          [17, 90],
        ] as [number, number][]
      ).map(([c, y], i) => (
        <rect
          key={`b-${i}`}
          x={c * 16}
          y={y}
          width="14"
          height="14"
          fill="#4a3820"
          stroke="#2a1a08"
          strokeWidth="0.5"
        />
      ))}
      {(
        [
          [3, 160],
          [9, 160],
          [14, 160],
        ] as [number, number][]
      ).map(([c, y], i) => (
        <polygon
          key={`s-${i}`}
          points={`${c * 16},${y + 20} ${c * 16 + 7},${y} ${c * 16 + 14},${y + 20}`}
          fill="#e8e6dd"
        />
      ))}
      <circle cx="85" cy="80" r="14" fill="#ff4d3a" stroke="#0a0a08" strokeWidth="2" />
      <circle cx="81" cy="76" r="3" fill="#ffb3a5" />
      <circle cx="230" cy="155" r="8" fill="none" stroke="#f5d800" strokeWidth="3" />
    </svg>
  ),

  'tic-tac-toe': () => {
    const board = [
      ['X', 'O', 'X'],
      ['.', 'X', 'O'],
      ['O', '.', 'X'],
    ]
    return (
      <svg viewBox="0 0 240 240" style={svgStyle}>
        <line x1="80" y1="10" x2="80" y2="230" stroke="#0a0a08" strokeWidth="3" />
        <line x1="160" y1="10" x2="160" y2="230" stroke="#0a0a08" strokeWidth="3" />
        <line x1="10" y1="80" x2="230" y2="80" stroke="#0a0a08" strokeWidth="3" />
        <line x1="10" y1="160" x2="230" y2="160" stroke="#0a0a08" strokeWidth="3" />
        {board.flat().map((v, i) => {
          const r = Math.floor(i / 3)
          const c = i % 3
          const cx = c * 80 + 40
          const cy = r * 80 + 40
          if (v === 'X')
            return (
              <g key={i}>
                <line
                  x1={cx - 20}
                  y1={cy - 20}
                  x2={cx + 20}
                  y2={cy + 20}
                  stroke="#ff4d3a"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <line
                  x1={cx + 20}
                  y1={cy - 20}
                  x2={cx - 20}
                  y2={cy + 20}
                  stroke="#ff4d3a"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </g>
            )
          if (v === 'O')
            return (
              <circle key={i} cx={cx} cy={cy} r="22" fill="none" stroke="#6a3fff" strokeWidth="5" />
            )
          return null
        })}
        <line
          x1="60"
          y1="40"
          x2="200"
          y2="180"
          stroke="#bfff3a"
          strokeWidth="4"
          opacity="0.6"
          strokeLinecap="round"
        />
      </svg>
    )
  },

  skribbl: () => (
    <svg viewBox="0 0 320 180" style={svgStyle}>
      <rect width="320" height="180" fill="#e8e6dd" />
      <path
        d="M 30 140 Q 60 60, 100 100 T 170 120 Q 200 90, 230 130 T 290 110"
        fill="none"
        stroke="#ff4d9e"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M 60 70 Q 80 50, 110 70"
        fill="none"
        stroke="#2563eb"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="240" cy="50" r="14" fill="none" stroke="#f5d800" strokeWidth="4" />
      <path d="M 240 50 L 260 30" stroke="#f5d800" strokeWidth="4" strokeLinecap="round" />
      {['_', '_', '_', '_', '_'].map((_, i) => (
        <line
          key={i}
          x1={110 + i * 22}
          y1="160"
          x2={124 + i * 22}
          y2="160"
          stroke="#0a0a08"
          strokeWidth="3"
        />
      ))}
    </svg>
  ),

  uno: () => {
    const cards = [
      { c: '#ff4d3a', label: '7' },
      { c: '#f5d800', label: '+2' },
      { c: '#2563eb', label: 'S' },
      { c: '#22c55e', label: 'R' },
      { c: '#0a0a08', label: 'W' },
    ]
    return (
      <svg viewBox="0 0 320 200" style={svgStyle}>
        {cards.map((card, i) => (
          <g
            key={i}
            transform={`translate(${20 + i * 52}, ${40 + (i % 2) * 10}) rotate(${(i - 2) * 6}, 32, 50)`}
          >
            <rect width="64" height="90" fill={card.c} stroke="#0a0a08" strokeWidth="2" rx="6" />
            <ellipse
              cx="32"
              cy="45"
              rx="22"
              ry="32"
              fill="#e8e6dd"
              transform="rotate(35, 32, 45)"
            />
            <text
              x="32"
              y="54"
              textAnchor="middle"
              fontFamily="'Space Grotesk', sans-serif"
              fontWeight="900"
              fontSize="28"
              fill={card.c === '#0a0a08' ? '#e8e6dd' : card.c}
            >
              {card.label}
            </text>
          </g>
        ))}
      </svg>
    )
  },

  agario: () => {
    const circles = [
      { x: 100, y: 90, r: 32, c: '#bfff3a' },
      { x: 200, y: 110, r: 22, c: '#ff4d9e' },
      { x: 250, y: 60, r: 14, c: '#2563eb' },
      { x: 60, y: 140, r: 10, c: '#f5d800' },
      { x: 160, y: 50, r: 8, c: '#ff4d3a' },
      { x: 280, y: 140, r: 16, c: '#a855f7' },
      { x: 30, y: 70, r: 6, c: '#22c55e' },
      { x: 220, y: 160, r: 7, c: '#ff8c2a' },
    ]
    return (
      <svg viewBox="0 0 320 200" style={svgStyle}>
        <rect width="320" height="200" fill="#0a0a08" />
        <defs>
          <pattern id="agario-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e1e1a" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="320" height="200" fill="url(#agario-grid)" />
        {circles.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={c.r}
            fill={c.c}
            opacity="0.9"
            stroke={c.c}
            strokeWidth="2"
          />
        ))}
      </svg>
    )
  },

  'cards-against-humanity': () => (
    <svg viewBox="0 0 320 200" style={svgStyle}>
      <g transform="translate(20, 30) rotate(-6)">
        <rect width="110" height="150" fill="#0a0a08" rx="4" />
        <text
          x="12"
          y="30"
          fontFamily="'Space Grotesk', sans-serif"
          fontWeight="700"
          fontSize="12"
          fill="#e8e6dd"
        >
          What ended
        </text>
        <text
          x="12"
          y="46"
          fontFamily="'Space Grotesk', sans-serif"
          fontWeight="700"
          fontSize="12"
          fill="#e8e6dd"
        >
          my last
        </text>
        <text
          x="12"
          y="62"
          fontFamily="'Space Grotesk', sans-serif"
          fontWeight="700"
          fontSize="12"
          fill="#e8e6dd"
        >
          relationship?
        </text>
        <text x="12" y="135" fontFamily="'JetBrains Mono', monospace" fontSize="9" fill="#6f6658">
          CAH
        </text>
        <rect x="12" y="140" width="20" height="2" fill="#6f6658" />
      </g>
      <g transform="translate(120, 50) rotate(4)">
        <rect width="110" height="140" fill="#e8e6dd" rx="4" stroke="#0a0a08" strokeWidth="1" />
        <text
          x="12"
          y="30"
          fontFamily="'Space Grotesk', sans-serif"
          fontWeight="700"
          fontSize="12"
          fill="#0a0a08"
        >
          A tiny horse.
        </text>
      </g>
      <g transform="translate(205, 40) rotate(8)">
        <rect width="110" height="140" fill="#e8e6dd" rx="4" stroke="#0a0a08" strokeWidth="1" />
        <text
          x="12"
          y="30"
          fontFamily="'Space Grotesk', sans-serif"
          fontWeight="700"
          fontSize="12"
          fill="#0a0a08"
        >
          My sex tape.
        </text>
      </g>
    </svg>
  ),

  codenames: () => {
    const cells = [
      { w: 'APPLE', t: 'red' },
      { w: 'SPRING', t: 'neutral' },
      { w: 'TOKYO', t: 'blue' },
      { w: 'NIGHT', t: 'red' },
      { w: 'BARK', t: 'blue' },
      { w: 'TABLE', t: 'assassin' },
      { w: 'MOON', t: 'blue' },
      { w: 'PILOT', t: 'red' },
      { w: 'SHADOW', t: 'neutral' },
      { w: 'DUST', t: 'red' },
    ] as const
    const fill: Record<string, string> = {
      red: '#ff4d3a',
      blue: '#2563eb',
      neutral: '#d8c9a0',
      assassin: '#0a0a08',
    }
    const text: Record<string, string> = {
      red: '#0a0a08',
      blue: '#e8e6dd',
      neutral: '#0a0a08',
      assassin: '#e8e6dd',
    }
    return (
      <svg viewBox="0 0 320 140" style={svgStyle}>
        {cells.map((cell, i) => {
          const c = i % 5
          const r = Math.floor(i / 5)
          return (
            <g key={i} transform={`translate(${c * 62 + 8}, ${r * 66 + 8})`}>
              <rect width="58" height="58" fill={fill[cell.t]} rx="3" />
              <text
                x="29"
                y="34"
                textAnchor="middle"
                fontFamily="'Space Grotesk', sans-serif"
                fontWeight="700"
                fontSize="10"
                fill={text[cell.t]}
              >
                {cell.w}
              </text>
            </g>
          )
        })}
      </svg>
    )
  },

  mindmeld: () => (
    <svg viewBox="0 0 320 200" style={svgStyle}>
      <rect width="320" height="200" fill="#0a0a08" />
      <path
        d="M 40 150 A 120 120 0 0 1 280 150"
        fill="none"
        stroke="#2a2a27"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M 40 150 A 120 120 0 0 1 100 60"
        fill="none"
        stroke="#2563eb"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M 100 60 A 120 120 0 0 1 160 30"
        fill="none"
        stroke="#a855f7"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M 160 30 A 120 120 0 0 1 220 60"
        fill="none"
        stroke="#ff4d9e"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M 220 60 A 120 120 0 0 1 280 150"
        fill="none"
        stroke="#ff4d3a"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <line x1="180" y1="150" x2="190" y2="35" stroke="#bfff3a" strokeWidth="3" />
      <circle cx="180" cy="150" r="8" fill="#bfff3a" />
      <text x="40" y="180" fontFamily="'JetBrains Mono', monospace" fontSize="11" fill="#6f6658">
        COLD
      </text>
      <text x="258" y="180" fontFamily="'JetBrains Mono', monospace" fontSize="11" fill="#6f6658">
        HOT
      </text>
    </svg>
  ),

  chess: () => {
    const board = Array.from({ length: 64 }, (_, i) => {
      const r = Math.floor(i / 8)
      const c = i % 8
      return (r + c) % 2 === 0 ? '#e8e6dd' : '#4a3820'
    })
    const pieces: Record<number, string> = {
      0: '♜',
      7: '♜',
      4: '♚',
      56: '♖',
      63: '♖',
      60: '♔',
      27: '♟',
      36: '♙',
    }
    return (
      <svg viewBox="0 0 240 240" style={svgStyle}>
        {board.map((col, i) => {
          const r = Math.floor(i / 8)
          const c = i % 8
          return (
            <g key={i}>
              <rect x={c * 30} y={r * 30} width="30" height="30" fill={col} />
              {pieces[i] && (
                <text
                  x={c * 30 + 15}
                  y={r * 30 + 22}
                  textAnchor="middle"
                  fontSize="20"
                  fill={col === '#e8e6dd' ? '#0a0a08' : '#e8e6dd'}
                >
                  {pieces[i]}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    )
  },
}

interface GamePosterProps {
  slug: string
  className?: string
  style?: CSSProperties
}

export function GamePoster({ slug, className, style }: GamePosterProps) {
  const Comp = Posters[slug]
  if (!Comp) return <div className={className} style={style} />
  return (
    <div
      className={className}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}
    >
      <Comp />
    </div>
  )
}
