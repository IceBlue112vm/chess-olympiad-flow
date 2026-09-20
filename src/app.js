const DATA_URL = "./data/processed/open/olympiad.json";

const GOATCOUNTER_CODE = "chess-olympiad-flow"

const width = 1300;

const startNodeRadius = 10;
const roundNodeRadius = 8;
const rowGap = 26;

const margin = {
  top: 60,
  right: 40,
  bottom: 40,
  left: 230,
};

const resultColors = {
  W: "#4caf50",
  D: "#f0b429",
  L: "#e25555",
};

const translations = {
  ko: {
    eyebrow: "2026 체스 올림피아드",

    subtitle:
      "각 국가의 순위가 라운드마다 어떻게 변화하는지 확인해보세요.",

    win: "승리",
    draw: "무승부",
    loss: "패배",
    notPaired: "미배정",

    rankingProgression: "순위 변화",

    interactionHelp:
      "노드에 마우스를 올리면 경기 정보를 확인할 수 있습니다. 클릭하면 해당 국가를 고정해서 볼 수 있습니다.",

    dataSource: "데이터 출처: Chess-Results",

    open: "오픈",
    women: "여자부",

    rounds: (first, last) =>
      `${first}–${last} 라운드`,

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
  },

  en: {
    eyebrow: "2026 Chess Olympiad",

    subtitle:
      "Explore how each team moves through the rankings round by round.",

    win: "Win",
    draw: "Draw",
    loss: "Loss",
    notPaired: "Not paired",

    rankingProgression: "Ranking progression",

    interactionHelp:
      "Hover over a node for match details. Click a node to keep a team highlighted.",

    dataSource: "Data source: Chess-Results",

    open: "Open",
    women: "Women",

    rounds: (first, last) =>
      `Rounds ${first}–${last}`,

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
  },
};

let currentLanguage = "ko";

async function main() {
  const data = await d3.json(DATA_URL);

  const teamsById = new Map(
    data.teams.map((team) => [team.id, team])
  );

  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip");

  /*
   * Interaction state
   */
  let selectedNode = null;
  let hoveredNode = null;
  let selectedTooltipPosition = null;

  /*
   * Translation helper
   */
  function t(key) {
    return translations[currentLanguage][key];
  }

  /*
   * Stages
   */
  const stages = [
    {
      key: "start",
    },

    ...data.rounds.map((round) => ({
      key: round,
    })),
  ];

  const maxSlots = data.teams.length;

  const height =
    margin.top +
    margin.bottom +
    (maxSlots - 1) * rowGap;

  const x = d3
    .scalePoint()
    .domain(
      stages.map((stage) => stage.key)
    )
    .range([
      margin.left,
      width - margin.right,
    ]);

  const y = d3
    .scaleLinear()
    .domain([1, maxSlots])
    .range([
      margin.top,
      margin.top +
        (maxSlots - 1) * rowGap,
    ]);

  /*
   * Display slots
   *
   * 공식 rank는 유지한다.
   * 동순위 팀만 화면상 다른 slot에 배치한다.
   */
  const displaySlots = new Map();

  for (const team of data.teams) {
    displaySlots.set(
      `start:${team.id}`,
      team.startRank
    );
  }

  for (const roundNumber of data.rounds) {
    const teamsInRound = data.teams
      .map((team) => {
        const round = team.rounds.find(
          (item) =>
            item.round === roundNumber
        );

        if (!round) {
          return null;
        }

        return {
          team,
          round,
        };
      })
      .filter(
        (item) => item !== null
      )
      .sort((a, b) => {
        if (
          a.round.rank !==
          b.round.rank
        ) {
          return (
            a.round.rank -
            b.round.rank
          );
        }

        return (
          a.team.id -
          b.team.id
        );
      });

    teamsInRound.forEach(
      (item, index) => {
        displaySlots.set(
          `${roundNumber}:${item.team.id}`,
          index + 1
        );
      }
    );
  }

  /*
   * Team path data
   */
  const paths = data.teams.map(
    (team) => {
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
        },

        ...data.rounds.map(
          (roundNumber) => {
            const round =
              roundsByNumber.get(
                roundNumber
              );

            if (!round) {
              return {
                stage: roundNumber,
                rank: null,
                displaySlot: null,

                opponentId: null,
                scoreFor: null,
                scoreAgainst: null,
                result: null,
                status: null,
              };
            }

            return {
              stage: roundNumber,

              rank:
                round.rank,

              displaySlot:
                displaySlots.get(
                  `${roundNumber}:${team.id}`
                ),

              opponentId:
                round.opponentId,

              scoreFor:
                round.scoreFor,

              scoreAgainst:
                round.scoreAgainst,

              result:
                round.result,

              status:
                round.status,
            };
          }
        ),
      ];

      return {
        team,
        points,
      };
    }
  );

  /*
   * SVG
   */
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr(
      "viewBox",
      `0 0 ${width} ${height}`
    );

  /*
   * Layers
   *
   * DOM layer 순서를 interaction 중
   * 변경하지 않는다.
   */
  const guideLayer = svg
    .append("g")
    .attr(
      "class",
      "guide-layer"
    );

  const pathLayer = svg
    .append("g")
    .attr(
      "class",
      "path-layer"
    );

  const nodeLayer = svg
    .append("g")
    .attr(
      "class",
      "node-layer"
    );

  const labelLayer = svg
    .append("g")
    .attr(
      "class",
      "label-layer"
    );

  /*
   * Stage guides
   */
  guideLayer
    .selectAll(".stage-line")
    .data(stages)
    .join("line")
    .attr(
      "class",
      "stage-line"
    )
    .attr(
      "x1",
      (stage) => x(stage.key)
    )
    .attr(
      "x2",
      (stage) => x(stage.key)
    )
    .attr(
      "y1",
      margin.top
    )
    .attr(
      "y2",
      margin.top +
        (maxSlots - 1) *
          rowGap
    );

  const stageLabels =
    guideLayer
      .selectAll(
        ".stage-label"
      )
      .data(stages)
      .join("text")
      .attr(
        "class",
        "stage-label"
      )
      .attr(
        "x",
        (stage) =>
          x(stage.key)
      )
      .attr("y", 30)
      .attr(
        "text-anchor",
        "middle"
      );

  /*
   * Paths
   */
  const line = d3
    .line()
    .defined(
      (point) =>
        point.displaySlot !== null
    )
    .x(
      (point) =>
        x(point.stage)
    )
    .y(
      (point) =>
        y(point.displaySlot)
    )
    .curve(
      d3.curveBumpX
    );

  const teamPaths =
    pathLayer
      .selectAll(
        ".team-path"
      )
      .data(paths)
      .join("path")
      .attr(
        "class",
        "team-path"
      )
      .attr(
        "d",
        (item) =>
          line(item.points)
      );

  /*
   * Flat node list
   */
  const nodes =
    paths.flatMap(
      ({ team, points }) =>
        points
          .filter(
            (point) =>
              point.displaySlot !==
              null
          )
          .map((point) => ({
            team,
            ...point,
          }))
    );

  /*
   * Nodes
   */
  const teamNodes =
    nodeLayer
      .selectAll(
        ".team-node"
      )
      .data(nodes)
      .join("circle")
      .attr(
        "class",
        "team-node selectable"
      )
      .attr(
        "cx",
        (node) =>
          x(node.stage)
      )
      .attr(
        "cy",
        (node) =>
          y(node.displaySlot)
      )
      .attr(
        "r",
        (node) =>
          node.stage ===
          "start"
            ? startNodeRadius
            : roundNodeRadius
      )
      .attr(
        "fill",
        (node) => {
          if (
            node.stage ===
            "start"
          ) {
            return "#777777";
          }

          return (
            resultColors[
              node.result
            ] ??
            "#777777"
          );
        }
      );

  /*
   * Team labels
   *
   * 현재 interaction 대상은 node만.
   */
  const teamNames =
    labelLayer
      .selectAll(
        ".team-name"
      )
      .data(data.teams)
      .join("text")
      .attr(
        "class",
        "team-name"
      )
      .attr(
        "x",
        x("start") -
          startNodeRadius -
          8
      )
      .attr(
        "y",
        (team) =>
          y(team.startRank)
      )
      .attr(
        "text-anchor",
        "end"
      )
      .attr(
        "dominant-baseline",
        "middle"
      )
      .text(
        (team) =>
          team.name
      );

  /*
   * Helpers
   */
  function getNodeKey(node) {
    return `${node.team.id}:${node.stage}`;
  }

  function getOpponentNodeKey(
    node
  ) {
    if (
      node.stage === "start" ||
      node.opponentId === null
    ) {
      return null;
    }

    return `${node.opponentId}:${node.stage}`;
  }

  /*
   * Tooltip
   */
  function getTooltipHtml(
    node
  ) {
    if (
      node.stage === "start"
    ) {
      return `
        <strong>${node.team.name}</strong><br>
        ${t("startRank")}: ${node.rank}<br>
        ${t("federation")}: ${node.team.federation}
      `;
    }

    const opponent =
      node.opponentId !== null
        ? teamsById.get(
            node.opponentId
          )
        : null;

    let opponentText =
      opponent
        ? opponent.name
        : "—";

    let scoreText =
      node.scoreFor !== null &&
      node.scoreAgainst !== null
        ? `${node.scoreFor} - ${node.scoreAgainst}`
        : "—";

    if (
      node.status === "bye"
    ) {
      opponentText =
        t("bye");
    }

    if (
      node.status ===
      "notPaired"
    ) {
      opponentText =
        t(
          "notPairedValue"
        );

      scoreText = "—";
    }

    return `
      <strong>${node.team.name}</strong><br>
      ${t("round")} ${node.stage}<br>
      ${t("rank")}: ${node.rank}<br>
      ${t("opponent")}: ${opponentText}<br>
      ${t("score")}: ${scoreText}
    `;
  }

  function showTooltip(
    node,
    pageX,
    pageY
  ) {
    tooltip
      .style(
        "display",
        "block"
      )
      .style(
        "left",
        `${pageX + 12}px`
      )
      .style(
        "top",
        `${pageY + 12}px`
      )
      .html(
        getTooltipHtml(node)
      );
  }

  function hideTooltip() {
    tooltip.style(
      "display",
      "none"
    );
  }

  /*
   * Language
   */
  function updateLanguage() {
    document.documentElement.lang =
      currentLanguage;

    /*
     * 일반 UI 텍스트
     */
    document
      .querySelectorAll(
        "[data-i18n]"
      )
      .forEach(
        (element) => {
          const key =
            element.dataset.i18n;

          const value =
            translations[
              currentLanguage
            ][key];

          if (
            typeof value ===
            "string"
          ) {
            element.textContent =
              value;
          }
        }
      );

    /*
     * Event label
     */
    const eventLabel =
      data.event === "open"
        ? t("open")
        : data.event ===
            "women"
          ? t("women")
          : data.event;

    d3
      .select(
        "#event-label"
      )
      .text(eventLabel);

    /*
     * Round label
     */
    d3
      .select(
        "#round-label"
      )
      .text(
        t("rounds")(
          data.rounds[0],
          data.rounds.at(-1)
        )
      );

    /*
     * Stage labels
     */
    stageLabels.text(
      (stage) =>
        stage.key === "start"
          ? t("start")
          : `R${stage.key}`
    );

    /*
     * Active language button
     */
    document
      .querySelectorAll(
        ".language-button"
      )
      .forEach(
        (button) => {
          button.classList.toggle(
            "active",
            button.dataset
              .language ===
              currentLanguage
          );
        }
      );

    /*
     * 고정 tooltip이 떠 있으면
     * 현재 언어로 즉시 갱신.
     */
    if (
      selectedNode !== null &&
      selectedTooltipPosition !==
        null
    ) {
      showTooltip(
        selectedNode,
        selectedTooltipPosition.x,
        selectedTooltipPosition.y
      );
    }
  }

  async function updateVisitorCount() {
    const todayVisitorCount =
      document.querySelector(
        "#today-visitor-count"
      );
  
    const totalVisitorCount =
      document.querySelector(
        "#total-visitor-count"
      );
  
    if (
      !todayVisitorCount ||
      !totalVisitorCount
    ) {
      return;
    }
  
    try {
      /*
       * 한국 시간 기준 오늘 날짜
       *
       * 예:
       * 2026-09-21
       */
      const today =
        new Intl.DateTimeFormat(
          "en-CA",
          {
            timeZone: "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }
        ).format(new Date());
  
      const totalUrl =
        `https://${GOATCOUNTER_CODE}` +
        `.goatcounter.com/counter/TOTAL.json`;
  
      const todayUrl =
        `https://${GOATCOUNTER_CODE}` +
        `.goatcounter.com/counter/TOTAL.json` +
        `?start=${today}&end=${today}`;
  
      const [
        totalResponse,
        todayResponse,
      ] = await Promise.all([
        fetch(totalUrl),
        fetch(todayUrl),
      ]);
  
      if (
        !totalResponse.ok ||
        !todayResponse.ok
      ) {
        throw new Error(
          "Failed to load visitor counts"
        );
      }
  
      const [
        totalData,
        todayData,
      ] = await Promise.all([
        totalResponse.json(),
        todayResponse.json(),
      ]);
  
      totalVisitorCount.textContent =
        totalData.count;
  
      todayVisitorCount.textContent =
        todayData.count;
    } catch (error) {
      console.error(error);
  
      totalVisitorCount.textContent =
        "—";
  
      todayVisitorCount.textContent =
        "—";
    }
  }

  /*
   * Language buttons
   */
  d3
    .selectAll(
      ".language-button"
    )
    .on(
      "click.language",
      function (event) {
        /*
         * document click에 의해
         * graph selection이 해제되지 않게 한다.
         */
        event.stopPropagation();

        currentLanguage =
          this.dataset.language;

        updateLanguage();
      }
    );

  /*
   * Selection이 있으면 Selection 우선.
   *
   * Selection이 없을 때만
   * hover가 visual focus가 된다.
   */
  function getFocusNode() {
    return (
      selectedNode ??
      hoveredNode
    );
  }

  function renderInteractionState() {
    const focusNode =
      getFocusNode();

    const focusedTeamId =
      focusNode?.team.id ??
      null;

    const opponentNodeKey =
      focusNode !== null
        ? getOpponentNodeKey(
            focusNode
          )
        : null;

    const hasFocus =
      focusNode !== null;

    /*
     * Paths
     */
    teamPaths
      .classed(
        "highlighted",
        (item) =>
          item.team.id ===
          focusedTeamId
      )
      .classed(
        "dimmed",
        (item) =>
          hasFocus &&
          item.team.id !==
            focusedTeamId
      );

    /*
     * Nodes
     */
    teamNodes
      .classed(
        "highlighted",
        (node) =>
          node.team.id ===
          focusedTeamId
      )
      .classed(
        "opponent-highlighted",
        (node) =>
          opponentNodeKey !==
            null &&
          getNodeKey(node) ===
            opponentNodeKey
      )
      .classed(
        "dimmed",
        (node) =>
          hasFocus &&
          node.team.id !==
            focusedTeamId &&
          getNodeKey(node) !==
            opponentNodeKey
      );

    /*
     * Team names
     */
    teamNames
      .classed(
        "highlighted",
        (team) =>
          team.id ===
          focusedTeamId
      )
      .classed(
        "dimmed",
        (team) =>
          hasFocus &&
          team.id !==
            focusedTeamId
      );

    /*
     * 강조된 path만
     * path layer 내에서 위로.
     */
    pathLayer
      .selectAll(
        ".team-path.highlighted"
      )
      .raise();
  }

  /*
   * Node hover
   */
  teamNodes
    .on(
      "pointerenter.hover",
      (event, node) => {
        hoveredNode =
          node;

        renderInteractionState();

        showTooltip(
          node,
          event.pageX,
          event.pageY
        );
      }
    )

    .on(
      "pointermove.tooltip",
      (event, node) => {
        showTooltip(
          node,
          event.pageX,
          event.pageY
        );
      }
    )

    .on(
      "pointerleave.hover",
      () => {
        hoveredNode =
          null;

        renderInteractionState();

        /*
         * 선택된 node가 있으면
         * 선택된 tooltip으로 복귀.
         */
        if (
          selectedNode !==
            null &&
          selectedTooltipPosition !==
            null
        ) {
          showTooltip(
            selectedNode,
            selectedTooltipPosition.x,
            selectedTooltipPosition.y
          );
        } else {
          hideTooltip();
        }
      }
    );

  /*
   * Node click
   *
   * 클릭된 node는 고정된다.
   * 다른 node hover는 selection을 변경하지 않는다.
   */
  teamNodes
    .on(
      "click.selection",
      (event, node) => {
        event.stopPropagation();

        selectedNode =
          node;

        selectedTooltipPosition = {
          x: event.pageX,
          y: event.pageY,
        };

        renderInteractionState();

        showTooltip(
          node,
          event.pageX,
          event.pageY
        );
      }
    );

  /*
   * Node 이외의 곳을 클릭하면
   * 모든 고정 highlight 해제.
   */
  d3
    .select(document)
    .on(
      "click.clear-selection",
      () => {
        selectedNode =
          null;

        selectedTooltipPosition =
          null;

        hoveredNode =
          null;

        hideTooltip();

        renderInteractionState();
      }
    );

  /*
   * Initial UI
   */
  updateLanguage();
  updateVisitorCount();

  renderInteractionState();
}

main();