const APP_CONFIG = {
  dataUrls: {
    open: "./data/processed/open/olympiad.json",
    women: "./data/processed/women/olympiad.json",
  },
  defaultEvent: "open",
  defaultLanguage: "ko",
  defaultTheme: "light",
  themeStorageKey: "chess-olympiad-flow-theme",
  goatCounterCode: "chess-olympiad-flow",
  chart: {
    minWidth: 1300,
    stageGap: 210,
    startNodeRadius: 10,
    roundNodeRadius: 8,
    rowGap: 26,
    margin: {
      top: 60,
      right: 230,
      bottom: 40,
      left: 230,
    },
  },
};

const RESULT_COLORS = {
  W: "#4caf50",
  D: "#f0b429",
  L: "#e25555",
};

const TRANSLATIONS = {
  ko: {
    eyebrow: "제46회 FIDE 체스 올림피아드",
    subtitle: "각 국가의 순위가 라운드마다 어떻게 변화하는지 확인해보세요.",
    win: "승리",
    draw: "무승부",
    loss: "패배",
    notPaired: "미배정",
    rankingProgression: "순위 변화",
    interactionHelp:
      "노드에 마우스를 올리면 경기 정보를 확인할 수 있습니다. 클릭하면 해당 국가를 고정해서 볼 수 있습니다.",
    dataSource: "데이터 출처: Chess-Results",
    openDivision: "오픈 부문",
    womenDivision: "여성 부문",
    start: "시작",
    startRank: "시작 순위",
    federation: "연맹",
    round: "라운드",
    rank: "순위",
    opponent: "상대",
    score: "스코어",
    bye: "부전승",
    notPairedValue: "미배정",
    todayVisits: "오늘 방문:",
    totalVisits: "누적 방문:",
    languageSwitch: "EN",
    languageSwitchLabel: "영어로 전환",
    darkMode: "다크 모드로 전환",
    lightMode: "라이트 모드로 전환",
  },
  en: {
    eyebrow: "46th FIDE Chess Olympiad",
    subtitle: "Explore how each team moves through the rankings round by round.",
    win: "Win",
    draw: "Draw",
    loss: "Loss",
    notPaired: "Not paired",
    rankingProgression: "Ranking progression",
    interactionHelp:
      "Hover over a node for match details. Click a node to keep a team highlighted.",
    dataSource: "Data source: Chess-Results",
    openDivision: "Open",
    womenDivision: "Women",
    start: "Start",
    startRank: "Start Rank",
    federation: "Federation",
    round: "Round",
    rank: "Rank",
    opponent: "Opponent",
    score: "Score",
    bye: "Bye",
    notPairedValue: "Not paired",
    todayVisits: "Today:",
    totalVisits: "Total visits:",
    languageSwitch: "한글",
    languageSwitchLabel: "Switch to Korean",
    darkMode: "Switch to dark mode",
    lightMode: "Switch to light mode",
  },
};

function loadSavedTheme() {
  try {
    const savedTheme =
      localStorage.getItem(
        APP_CONFIG.themeStorageKey
      );

    if (
      savedTheme === "light" ||
      savedTheme === "dark"
    ) {
      return savedTheme;
    }
  } catch {
    // localStorage 사용 불가
  }

  return APP_CONFIG.defaultTheme;
}

function saveTheme(theme) {
  try {
    localStorage.setItem(
      APP_CONFIG.themeStorageKey,
      theme
    );
  } catch {
    // 저장 실패 시에도 테마 기능 자체는 계속 동작한다.
  }
}

const appState = {
  event: APP_CONFIG.defaultEvent,
  language: APP_CONFIG.defaultLanguage,
  theme: loadSavedTheme(),
};

let currentChart = null;

function t(key) {
  return TRANSLATIONS[appState.language][key];
}

function updateStaticTranslations() {
  document.documentElement.lang =
    appState.language;

  document
    .querySelectorAll("[data-i18n]")
    .forEach((element) => {
      const value =
        TRANSLATIONS[
          appState.language
        ][element.dataset.i18n];

      if (typeof value === "string") {
        element.textContent = value;
      }
    });

  const languageButton =
    document.querySelector(
      "[data-language-toggle]"
    );

  if (languageButton) {
    languageButton.textContent =
      t("languageSwitch");

    languageButton.setAttribute(
      "aria-label",
      t("languageSwitchLabel")
    );

    languageButton.title =
      t("languageSwitchLabel");
  }

  updateTheme();
}

function updateTheme() {
  document.documentElement.dataset.theme =
    appState.theme;

  const themeButton =
    document.querySelector(
      "[data-theme-toggle]"
    );

  if (!themeButton) {
    return;
  }

  const label =
    appState.theme === "dark"
      ? t("lightMode")
      : t("darkMode");

  themeButton.setAttribute(
    "aria-label",
    label
  );

  themeButton.title = label;
}

function getTeamDisplayName(team) {
  return window.TeamNames.getDisplayName(
    team,
    appState.language
  );
}

function getTeamFlagUrl(team) {
  const federation =
    team.federation
      ?.trim()
      .toLowerCase();

  if (!federation) {
    return null;
  }

  return (
    "https://chess-results.com/images/f90/" +
    `tn_${encodeURIComponent(federation)}.gif`
  );
}

function updateEventControls() {
  document
    .querySelectorAll("[data-event]")
    .forEach((button) => {
      const isActive =
        button.dataset.event === appState.event;

      button.classList.toggle(
        "active",
        isActive
      );

      button.setAttribute(
        "aria-pressed",
        String(isActive)
      );
    });
}

function setupLanguageToggle() {
  const languageButton =
    document.querySelector(
      "[data-language-toggle]"
    );

  if (!languageButton) {
    return;
  }

  languageButton.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();

      appState.language =
        appState.language === "ko"
          ? "en"
          : "ko";

      updateStaticTranslations();

      currentChart
        ?.refreshLanguageDependentChartText();
    }
  );
}

function setupThemeToggle() {
  const themeButton =
    document.querySelector(
      "[data-theme-toggle]"
    );

  if (!themeButton) {
    return;
  }

  themeButton.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();

      appState.theme = appState.theme === "light" ? "dark" : "light";

      saveTheme(appState.theme);
      updateTheme();
    }
  );
}

function setupEventToggle() {
  const eventButtons =
    document.querySelectorAll(
      "[data-event]"
    );

  eventButtons.forEach((button) => {
    button.addEventListener(
      "click",
      async (event) => {
        event.stopPropagation();

        const eventName =
          button.dataset.event;

        if (
          !eventName ||
          eventName === appState.event
        ) {
          return;
        }

        eventButtons.forEach(
          (eventButton) => {
            eventButton.disabled = true;
          }
        );

        const chartElement =
          document.querySelector("#chart");

        chartElement?.setAttribute(
          "aria-busy",
          "true"
        );

        try {
          const data =
            await loadTournamentData(
              eventName
            );

          appState.event =
            eventName;

          updateEventControls();

          currentChart =
            renderChart(data);
        } catch (error) {
          console.error(
            `Failed to load ${eventName} tournament`,
            error
          );
        } finally {
          eventButtons.forEach(
            (eventButton) => {
              eventButton.disabled = false;
            }
          );

          chartElement?.removeAttribute(
            "aria-busy"
          );
        }
      }
    );
  });
}

function getSeoulDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function updateVisitorCount() {
  const todayElement = document.querySelector("#today-visitor-count");
  const totalElement = document.querySelector("#total-visitor-count");

  if (!todayElement || !totalElement) {
    return;
  }

  const baseUrl = `https://${APP_CONFIG.goatCounterCode}.goatcounter.com/counter/TOTAL.json`;
  const today = getSeoulDateString();

  try {
    const [totalResponse, todayResponse] = await Promise.all([
      fetch(baseUrl),
      fetch(`${baseUrl}?start=${today}&end=${today}`),
    ]);

    if (!totalResponse.ok || !todayResponse.ok) {
      throw new Error("Failed to load visitor counts");
    }

    const [totalData, todayData] = await Promise.all([
      totalResponse.json(),
      todayResponse.json(),
    ]);

    totalElement.textContent = totalData.count;
    todayElement.textContent = todayData.count;
  } catch (error) {
    console.error(error);
    totalElement.textContent = "—";
    todayElement.textContent = "—";
  }
}

function buildDisplaySlots(data) {
  const displaySlots = new Map();

  for (const team of data.teams) {
    displaySlots.set(
      `start:${team.id}`,
      team.startRank
    );
  }

  const latestCompletedRound =
    data.rounds.at(-1);

  const currentRound =
    latestCompletedRound + 1;

  for (
    let roundNumber = 1;
    roundNumber <= currentRound;
    roundNumber += 1
  ) {
    const teamsInRound = data.teams
      .map((team) => {
        let rank;

        if (roundNumber === 1) {
          rank = team.startRank;
        } else {
          const previousRound =
            team.rounds.find(
              (item) =>
                item.round ===
                roundNumber - 1
            );

          rank =
            previousRound?.rank ??
            null;
        }

        if (rank === null) {
          return null;
        }

        return {
          team,
          rank,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.rank !== b.rank) {
          return a.rank - b.rank;
        }

        return a.team.id - b.team.id;
      });

    teamsInRound.forEach(
      ({ team }, index) => {
        displaySlots.set(
          `${roundNumber}:${team.id}`,
          index + 1
        );
      }
    );
  }

  return displaySlots;
}

function buildTeamPaths(
  data,
  displaySlots
) {
  const latestCompletedRound =
    data.rounds.at(-1);

  const currentRound =
    latestCompletedRound + 1;

  const roundStages =
    Array.from(
      {
        length: currentRound,
      },
      (_, index) => index + 1
    );

  return data.teams.map((team) => {
    const roundsByNumber =
      new Map(
        team.rounds.map(
          (round) => [
            round.round,
            round,
          ]
        )
      );

    const points = [
      {
        stage: "start",
        rank: team.startRank,
        displaySlot:
          displaySlots.get(
            `start:${team.id}`
          ),
        opponentId: null,
        scoreFor: null,
        scoreAgainst: null,
        result: null,
        status: null,
        boards: [],
      },

      ...roundStages.map(
        (roundNumber) => {
          const previousRank =
            roundNumber === 1
              ? team.startRank
              : roundsByNumber.get(
                    roundNumber - 1
                  )?.rank ?? null;

          const match =
            roundsByNumber.get(
              roundNumber
            );

          return {
            stage: roundNumber,
            rank: previousRank,

            displaySlot:
              previousRank !== null
                ? displaySlots.get(
                    `${roundNumber}:${team.id}`
                  ) ?? null
                : null,

            opponentId:
              match?.opponentId ??
              null,

            scoreFor:
              match?.scoreFor ??
              null,

            scoreAgainst:
              match?.scoreAgainst ??
              null,

            result:
              match?.result ??
              null,

            status:
              match?.status ??
              null,

            boards:
              match?.boards ??
              [],
          };
        }
      ),
    ];

    return {
      team,
      points,
    };
  });
}

function createTooltip() {
  return d3
    .select("body")
    .selectAll(".tooltip")
    .data([null])
    .join("div")
    .attr("class", "tooltip");
}

function renderChart(data) {
  const {
    minWidth,
    stageGap,
    startNodeRadius,
    roundNodeRadius,
    rowGap,
    margin,
  } = APP_CONFIG.chart;

  const chartRoot = d3.select("#chart");
  chartRoot.selectAll("*").remove();

  const tooltip = createTooltip();
  tooltip.style("display", "none");
  const teamsById = new Map(data.teams.map((team) => [team.id, team]));

  const interaction = {
    selectedNode: null,
    hoveredNode: null,
    selectedTooltipPosition: null,
  };

  const latestCompletedRound =
    data.rounds.at(-1);
  
  const latestRound =
    latestCompletedRound + 1;
  
  const stages = [
    {
      key: "start",
    },
  
    ...Array.from(
      {
        length: latestRound,
      },
      (_, index) => ({
        key: index + 1,
      })
    ),
  ];

  const maxSlots = data.teams.length;

  const width = Math.max(
    minWidth,
    margin.left + margin.right + (stages.length - 1) * stageGap
  );

  const height =
    margin.top + margin.bottom + Math.max(0, maxSlots - 1) * rowGap;

  const x = d3
    .scalePoint()
    .domain(stages.map((stage) => stage.key))
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleLinear()
    .domain([1, maxSlots])
    .range([margin.top, margin.top + Math.max(0, maxSlots - 1) * rowGap]);

  const displaySlots = buildDisplaySlots(data);
  const paths = buildTeamPaths(data, displaySlots);

  const nodes = paths.flatMap(({ team, points }) =>
    points
      .filter((point) => point.displaySlot !== null)
      .map((point) => ({ team, ...point }))
  );

  const svg = chartRoot
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

  const guideLayer = svg.append("g").attr("class", "guide-layer");
  const pathLayer = svg.append("g").attr("class", "path-layer");
  const connectorLayer = svg.append("g").attr("class", "connector-layer");
  const nodeLayer = svg.append("g").attr("class", "node-layer");
  const labelLayer = svg.append("g").attr("class", "label-layer");

  guideLayer
    .selectAll(".stage-line")
    .data(stages)
    .join("line")
    .attr("class", "stage-line")
    .attr("x1", (stage) => x(stage.key))
    .attr("x2", (stage) => x(stage.key))
    .attr("y1", margin.top)
    .attr("y2", margin.top + Math.max(0, maxSlots - 1) * rowGap);

  const stageLabels = guideLayer
    .selectAll(".stage-label")
    .data(stages)
    .join("text")
    .attr("class", "stage-label")
    .attr("x", (stage) => x(stage.key))
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .text((stage) => (stage.key === "start" ? t("start") : `R${stage.key}`));

  const line = d3
    .line()
    .defined((point) => point.displaySlot !== null)
    .x((point) => x(point.stage))
    .y((point) => y(point.displaySlot))
    .curve(d3.curveBumpX);

  const teamPaths = pathLayer
    .selectAll(".team-path")
    .data(paths)
    .join("path")
    .attr("class", "team-path")
    .attr("d", (item) => line(item.points));

  const nodesByKey = new Map(
    nodes.map((node) => [
      `${node.team.id}:${node.stage}`,
      node,
    ])
  );

  const defs = svg.append("defs");

  const matchGradientId =
    `match-connector-gradient-${data.event}`;

  const matchGradient = defs
    .append("linearGradient")
    .attr("id", matchGradientId)
    .attr("gradientUnits", "userSpaceOnUse");

  const startFlagClipId =
    `start-flag-clip-${data.event}`;

  defs
    .append("clipPath")
    .attr("id", startFlagClipId)
    .attr(
      "clipPathUnits",
      "objectBoundingBox"
    )
    .append("circle")
    .attr("cx", 0.5)
    .attr("cy", 0.5)
    .attr("r", 0.5);

  const matchGradientStart = matchGradient
    .append("stop")
    .attr("offset", "0%");

  const matchGradientEnd = matchGradient
    .append("stop")
    .attr("offset", "100%");

  const matchConnector = connectorLayer
    .append("path")
    .attr("class", "match-connector")
    .style("display", "none");

  const teamNodes = nodeLayer
    .selectAll(".team-node")
    .data(nodes)
    .join("circle")
    .attr("class", "team-node selectable")
    .attr("cx", (node) => x(node.stage))
    .attr("cy", (node) => y(node.displaySlot))
    .attr("r", (node) =>
      node.stage === "start" ? startNodeRadius : roundNodeRadius
    )
    .attr("fill", (node) => {
      if (node.stage === "start") {
        return "var(--neutral)";
      }

      return RESULT_COLORS[node.result] ?? "#777777";
    });

  const startNodes = nodes.filter(
    (node) => node.stage === "start"
  );

  const startFlagRadius =
    Math.max(1, startNodeRadius - 1);

  const startFlagImages = nodeLayer
    .selectAll(".start-flag")
    .data(startNodes)
    .join("image")
    .attr("class", "start-flag")
    .attr(
      "x",
      x("start") - startFlagRadius
    )
    .attr(
      "y",
      (node) =>
        y(node.displaySlot) -
        startFlagRadius
    )
    .attr(
      "width",
      startFlagRadius * 2
    )
    .attr(
      "height",
      startFlagRadius * 2
    )
    .attr(
      "href",
      (node) =>
        getTeamFlagUrl(node.team)
    )
    .attr(
      "preserveAspectRatio",
      "xMidYMid slice"
    )
    .attr(
      "clip-path",
      `url(#${startFlagClipId})`
    )
    .on(
      "error",
      function () {
        d3.select(this).style(
          "display",
          "none"
        );
      }
    );

  const teamNames = labelLayer
    .selectAll(".start-team-name")
    .data(data.teams)
    .join("text")
    .attr("class", "team-name start-team-name")
    .classed("korea-team-name", (team) => team.federation === "KOR")
    .attr("x", x("start") - startNodeRadius - 8)
    .attr("y", (team) => y(team.startRank))
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .text((team) => getTeamDisplayName(team));

  const latestRoundNodes = nodes.filter((node) => node.stage === latestRound);

  const latestTeamNames = labelLayer
    .selectAll(".latest-team-name")
    .data(latestRoundNodes)
    .join("text")
    .attr("class", "team-name latest-team-name")
    .classed("korea-team-name", (node) => node.team.federation === "KOR")
    .attr("x", x(latestRound) + roundNodeRadius + 8)
    .attr("y", (node) => y(node.displaySlot))
    .attr("text-anchor", "start")
    .attr("dominant-baseline", "middle")
    .text((node) => getTeamDisplayName(node.team));

  function getNodeKey(node) {
    return `${node.team.id}:${node.stage}`;
  }

  function getOpponentNodeKey(node) {
    if (node.stage === "start" || node.opponentId === null) {
      return null;
    }

    return `${node.opponentId}:${node.stage}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getBoardPlayerHtml(
    title,
    name
  ) {
    const safeTitle = escapeHtml(title);
    const safeName = escapeHtml(name);

    if (!safeTitle) {
      return safeName;
    }

    return (
      `<span class="tooltip-player-title">` +
      `${safeTitle}</span> ${safeName}`
    );
  }

  function getBoardResultsHtml(node) {
    if (
      !Array.isArray(node.boards) ||
      node.boards.length === 0
    ) {
      return "";
    }

    const rows = node.boards
      .map((board) => {
        const player =
          getBoardPlayerHtml(
            board.playerTitle,
            board.player
          );

        const opponent =
          getBoardPlayerHtml(
            board.opponentTitle,
            board.opponent
          );

        const boardScore =
          `${escapeHtml(board.scoreFor)} - ` +
          `${escapeHtml(board.scoreAgainst)}`;

        return `
          <div class="tooltip-board-row">
            <span class="tooltip-board-number">${escapeHtml(board.board)}</span>
            <span class="tooltip-board-player">${player}</span>
            <span class="tooltip-board-score">${boardScore}</span>
            <span class="tooltip-board-player tooltip-board-opponent">${opponent}</span>
          </div>
        `;
      })
      .join("");

    return `
      <div class="tooltip-board-results">
        ${rows}
      </div>
    `;
  }

  function getRankText(rank) {
    if (rank === null || rank === undefined) {
      return "—";
    }

    return appState.language === "ko"
      ? `${rank}위`
      : `${t("rank")} ${rank}`;
  }

  function getRoundText(roundNumber) {
    return appState.language === "ko"
      ? `${roundNumber}${t("round")}`
      : `${t("round")} ${roundNumber}`;
  }

  function getRosterHtml(team) {
    if (
      !Array.isArray(team.players) ||
      team.players.length === 0
    ) {
      return "";
    }
  
    const rows = team.players
      .map((player) => {
        const playerName =
          getBoardPlayerHtml(
            player.title,
            player.name
          );
  
        return `
          <div class="tooltip-roster-row">
            <span class="tooltip-roster-order">
              ${escapeHtml(player.order)}
            </span>
  
            <span class="tooltip-roster-player">
              ${playerName}
            </span>
  
            <span class="tooltip-roster-rating">
              ${escapeHtml(player.rating)}
            </span>
          </div>
        `;
      })
      .join("");
  
    return `
      <div class="tooltip-roster">
        ${rows}
      </div>
    `;
  }

  function getTooltipHtml(node) {
    if (node.stage === "start") {
      return `
        <strong>
          ${escapeHtml(getTeamDisplayName(node.team))}
        </strong><br>

        ${t("startRank")}: ${node.rank}

        ${getRosterHtml(node.team)}
      `;
    }

    const opponent =
      node.opponentId !== null
        ? teamsById.get(node.opponentId)
        : null;

    let opponentText =
      opponent
        ? escapeHtml(getTeamDisplayName(opponent))
        : "—";

    const scoreText =
      node.scoreFor !== null &&
      node.scoreAgainst !== null
        ? `${node.scoreFor} - ${node.scoreAgainst}`
        : "—";

    if (node.status === "bye") {
      return `
        <strong>${escapeHtml(getTeamDisplayName(node.team))}</strong><br>
        ${getRoundText(node.stage)}<br>
        ${t("rank")}: ${node.rank}<br>
        ${t("opponent")}: ${t("bye")}<br>
        ${t("score")}: ${scoreText}
      `;
    }

    if (node.status === "notPaired") {
      return `
        <strong>${escapeHtml(getTeamDisplayName(node.team))}</strong><br>
        ${getRoundText(node.stage)}<br>
        ${t("rank")}: ${node.rank}<br>
        ${t("opponent")}: ${t("notPairedValue")}<br>
        ${t("score")}: —
      `;
    }

    const opponentNode =
      node.opponentId !== null
        ? nodesByKey.get(
            `${node.opponentId}:${node.stage}`
          )
        : null;

    const teamName =
      escapeHtml(
        getTeamDisplayName(node.team)
      );

    const opponentName =
      opponent
        ? escapeHtml(
            getTeamDisplayName(opponent)
          )
        : "—";

    const teamRank =
      escapeHtml(
        getRankText(node.rank)
      );

    const opponentRank =
      escapeHtml(
        getRankText(
          opponentNode?.rank
        )
      );

    return `
      <div class="tooltip-round-label">
        ${escapeHtml(getRoundText(node.stage))}
      </div>

      <div class="tooltip-match-summary">
        <div class="tooltip-match-team tooltip-match-team-left">
          ${teamName}
          <span class="tooltip-match-rank">(${teamRank})</span>
        </div>

        <div class="tooltip-match-score">
          ${scoreText}
        </div>

        <div class="tooltip-match-team tooltip-match-team-right">
          ${opponentName}
          <span class="tooltip-match-rank">(${opponentRank})</span>
        </div>
      </div>

      ${getBoardResultsHtml(node)}
    `;
  }

  function showTooltip(node, pageX, pageY) {
    const hasRoster =
      node.stage === "start" &&
      Array.isArray(node.team.players) &&
      node.team.players.length > 0;

    const hasBoardResults =
      Array.isArray(node.boards) &&
      node.boards.length > 0;

    tooltip
      .classed(
        "has-board-results",
        hasBoardResults
      )
      .classed(
        "has-roster",
        hasRoster
      )
      .style("display", "block")
      .style("left", "0px")
      .style("top", "0px")
      .html(getTooltipHtml(node));

    const tooltipElement = tooltip.node();

    if (!tooltipElement) {
      return;
    }

    const rect =
      tooltipElement.getBoundingClientRect();

    const viewportLeft =
      window.scrollX + 12;
    const viewportTop =
      window.scrollY + 12;
    const viewportRight =
      window.scrollX +
      window.innerWidth -
      rect.width -
      12;
    const viewportBottom =
      window.scrollY +
      window.innerHeight -
      rect.height -
      12;

    let left = pageX + 12;
    let top = pageY + 12;

    if (left > viewportRight) {
      left = Math.max(
        viewportLeft,
        pageX - rect.width - 12
      );
    }

    if (top > viewportBottom) {
      top = Math.max(
        viewportTop,
        pageY - rect.height - 12
      );
    }

    tooltip
      .style("left", `${left}px`)
      .style("top", `${top}px`);
  }

  function hideTooltip() {
    tooltip.style("display", "none");
  }

  function getFocusNode() {
    return interaction.selectedNode ?? interaction.hoveredNode;
  }

  function getMatchFocusNode() {
    if (
      interaction.selectedNode?.stage === "start" &&
      interaction.hoveredNode !== null &&
      interaction.hoveredNode.team.id ===
        interaction.selectedNode.team.id
    ) {
      return interaction.hoveredNode;
    }

    return getFocusNode();
  }

  function hideMatchConnector() {
    matchConnector.style("display", "none");
  }

  function updateMatchConnector(focusNode) {
    const opponentNodeKey = focusNode
      ? getOpponentNodeKey(focusNode)
      : null;

    if (opponentNodeKey === null) {
      hideMatchConnector();
      return;
    }

    const opponentNode = nodesByKey.get(opponentNodeKey);

    if (!opponentNode) {
      hideMatchConnector();
      return;
    }

    const nodeX = x(focusNode.stage);
    const focusY = y(focusNode.displaySlot);
    const opponentY = y(opponentNode.displaySlot);

    const connectorDirection = -1;

    const connectorX =
      nodeX + connectorDirection * 18;

    const focusColor =
      RESULT_COLORS[focusNode.result] ??
      "#777777";

    const opponentColor =
      RESULT_COLORS[opponentNode.result] ??
      "#777777";

    const isDraw =
      focusNode.result === "D" &&
      opponentNode.result === "D";

    if (isDraw) {
      matchConnector.attr(
        "stroke",
        RESULT_COLORS.D
      );
    } else {
      matchGradient
        .attr("x1", nodeX)
        .attr("y1", focusY)
        .attr("x2", nodeX)
        .attr("y2", opponentY);

      matchGradientStart.attr(
        "stop-color",
        focusColor
      );

      matchGradientEnd.attr(
        "stop-color",
        opponentColor
      );

      matchConnector.attr(
        "stroke",
        `url(#${matchGradientId})`
      );
    }

    matchConnector
      .attr(
        "d",
        `M ${nodeX} ${focusY} H ${connectorX} V ${opponentY} H ${nodeX}`
      )
      .style("display", null);
  }

  function renderInteractionState() {
    const focusNode = getFocusNode();
    const matchFocusNode = getMatchFocusNode();

    const focusedTeamId = focusNode?.team.id ?? null;
    const opponentNodeKey = matchFocusNode
      ? getOpponentNodeKey(matchFocusNode)
      : null;

    const hasFocus = focusNode !== null;

    updateMatchConnector(
      matchFocusNode
    );

    teamPaths
      .classed("highlighted", (item) => item.team.id === focusedTeamId)
      .classed(
        "dimmed",
        (item) => hasFocus && item.team.id !== focusedTeamId
      );

    teamNodes
      .classed("highlighted", (node) => node.team.id === focusedTeamId)
      .classed(
        "opponent-highlighted",
        (node) =>
          opponentNodeKey !== null && getNodeKey(node) === opponentNodeKey
      )
      .classed(
        "dimmed",
        (node) =>
          hasFocus &&
          node.team.id !== focusedTeamId &&
          getNodeKey(node) !== opponentNodeKey
      );

    startFlagImages
      .classed(
        "dimmed",
        (node) =>
          hasFocus &&
          node.team.id !==
            focusedTeamId
      );

    teamNames
      .classed("highlighted", (team) => team.id === focusedTeamId)
      .classed("dimmed", (team) => hasFocus && team.id !== focusedTeamId);

    latestTeamNames
      .classed("highlighted", (node) => node.team.id === focusedTeamId)
      .classed(
        "dimmed",
        (node) => hasFocus && node.team.id !== focusedTeamId
      );

    pathLayer.selectAll(".team-path.highlighted").raise();
  }

  teamNodes
    .on("pointerenter.hover", (event, node) => {
      interaction.hoveredNode = node;
      renderInteractionState();
      showTooltip(node, event.pageX, event.pageY);
    })
    .on("pointermove.tooltip", (event, node) => {
      showTooltip(node, event.pageX, event.pageY);
    })
    .on("pointerleave.hover", () => {
      interaction.hoveredNode = null;
      renderInteractionState();

      if (
        interaction.selectedNode !== null &&
        interaction.selectedTooltipPosition !== null
      ) {
        showTooltip(
          interaction.selectedNode,
          interaction.selectedTooltipPosition.x,
          interaction.selectedTooltipPosition.y
        );
      } else {
        hideTooltip();
      }
    })
    .on("click.selection", (event, node) => {
      event.stopPropagation();

      interaction.selectedNode = node;
      interaction.selectedTooltipPosition = {
        x: event.pageX,
        y: event.pageY,
      };

      renderInteractionState();
      showTooltip(node, event.pageX, event.pageY);
    });

  d3.select(document).on("click.chart-clear", () => {
    interaction.selectedNode = null;
    interaction.hoveredNode = null;
    interaction.selectedTooltipPosition = null;

    hideTooltip();
    renderInteractionState();
  });

  function refreshLanguageDependentChartText() {
    stageLabels.text(
      (stage) =>
        stage.key === "start"
          ? t("start")
          : `R${stage.key}`
    );
  
    teamNames.text(
      (team) =>
        getTeamDisplayName(team)
    );
  
    latestTeamNames.text(
      (node) =>
        getTeamDisplayName(node.team)
    );
  
    updateMatchConnector(
      getMatchFocusNode()
    );

    if (
      interaction.selectedNode !== null &&
      interaction.selectedTooltipPosition !== null
    ) {
      showTooltip(
        interaction.selectedNode,
        interaction.selectedTooltipPosition.x,
        interaction.selectedTooltipPosition.y
      );
    }
  }

  renderInteractionState();

  return {
    refreshLanguageDependentChartText,
  };
}

async function loadTournamentData(eventName) {
  const url = APP_CONFIG.dataUrls[eventName];

  if (!url) {
    throw new Error(`Unknown event: ${eventName}`);
  }

  return d3.json(url);
}

async function main() {
  updateStaticTranslations();

  setupLanguageToggle();
  setupThemeToggle();
  setupEventToggle();

  updateEventControls();
  updateVisitorCount();

  try {
    const data =
      await loadTournamentData(
        appState.event
      );

    currentChart =
      renderChart(data);
  } catch (error) {
    console.error(
      "Failed to initialize Chess Olympiad Flow",
      error
    );
  }
}

main();
