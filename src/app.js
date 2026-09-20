const DATA_URL = "./data/processed/open/olympiad.json";

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

  const stages = [
    {
      key: "start",
      label: "Start",
    },
    ...data.rounds.map((round) => ({
      key: round,
      label: `R${round}`,
    })),
  ];

  const maxSlots = data.teams.length;

  const height =
    margin.top +
    margin.bottom +
    (maxSlots - 1) * rowGap;

  const x = d3
    .scalePoint()
    .domain(stages.map((stage) => stage.key))
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleLinear()
    .domain([1, maxSlots])
    .range([
      margin.top,
      margin.top + (maxSlots - 1) * rowGap,
    ]);

  /*
   * Display slots
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
          (item) => item.round === roundNumber
        );

        if (!round) {
          return null;
        }

        return {
          team,
          round,
        };
      })
      .filter((item) => item !== null)
      .sort((a, b) => {
        if (a.round.rank !== b.round.rank) {
          return a.round.rank - b.round.rank;
        }

        return a.team.id - b.team.id;
      });

    teamsInRound.forEach((item, index) => {
      displaySlots.set(
        `${roundNumber}:${item.team.id}`,
        index + 1
      );
    });
  }

  /*
   * Team path data
   */
  const paths = data.teams.map((team) => {
    const roundsByNumber = new Map(
      team.rounds.map((round) => [
        round.round,
        round,
      ])
    );

    const points = [
      {
        stage: "start",
        rank: team.startRank,
        displaySlot: displaySlots.get(
          `start:${team.id}`
        ),
        opponentId: null,
        scoreFor: null,
        scoreAgainst: null,
        result: null,
        status: null,
      },

      ...data.rounds.map((roundNumber) => {
        const round =
          roundsByNumber.get(roundNumber);

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
          rank: round.rank,
          displaySlot: displaySlots.get(
            `${roundNumber}:${team.id}`
          ),
          opponentId: round.opponentId,
          scoreFor: round.scoreFor,
          scoreAgainst: round.scoreAgainst,
          result: round.result,
          status: round.status,
        };
      }),
    ];

    return {
      team,
      points,
    };
  });

  /*
   * SVG
   */
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

  /*
   * Layers
   *
   * DOM 순서를 interaction 도중 바꾸지 않는다.
   */
  const guideLayer = svg
    .append("g")
    .attr("class", "guide-layer");

  const pathLayer = svg
    .append("g")
    .attr("class", "path-layer");

  const nodeLayer = svg
    .append("g")
    .attr("class", "node-layer");

  const labelLayer = svg
    .append("g")
    .attr("class", "label-layer");

  /*
   * Stage guides
   */
  guideLayer
    .selectAll(".stage-line")
    .data(stages)
    .join("line")
    .attr("class", "stage-line")
    .attr("x1", (stage) => x(stage.key))
    .attr("x2", (stage) => x(stage.key))
    .attr("y1", margin.top)
    .attr(
      "y2",
      margin.top + (maxSlots - 1) * rowGap
    );

  guideLayer
    .selectAll(".stage-label")
    .data(stages)
    .join("text")
    .attr("class", "stage-label")
    .attr("x", (stage) => x(stage.key))
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .text((stage) => stage.label);

  /*
   * Paths
   */
  const line = d3
    .line()
    .defined(
      (point) => point.displaySlot !== null
    )
    .x((point) => x(point.stage))
    .y((point) => y(point.displaySlot))
    .curve(d3.curveBumpX);

  const teamPaths = pathLayer
    .selectAll(".team-path")
    .data(paths)
    .join("path")
    .attr("class", "team-path")
    .attr(
      "d",
      (item) => line(item.points)
    );

  /*
   * Flat node list
   */
  const nodes = paths.flatMap(
    ({ team, points }) =>
      points
        .filter(
          (point) =>
            point.displaySlot !== null
        )
        .map((point) => ({
          team,
          ...point,
        }))
  );

  /*
   * Nodes
   */
  const teamNodes = nodeLayer
    .selectAll(".team-node")
    .data(nodes)
    .join("circle")
    .attr("class", "team-node selectable")
    .attr(
      "cx",
      (node) => x(node.stage)
    )
    .attr(
      "cy",
      (node) => y(node.displaySlot)
    )
    .attr(
      "r",
      (node) =>
        node.stage === "start"
          ? startNodeRadius
          : roundNodeRadius
    )
    .attr("fill", (node) => {
      if (node.stage === "start") {
        return "#777777";
      }

      return (
        resultColors[node.result] ??
        "#777777"
      );
    });

  /*
   * Team labels
   *
   * 현재는 표시만 한다.
   * hover / selection 대상은 node만.
   */
  const teamNames = labelLayer
    .selectAll(".team-name")
    .data(data.teams)
    .join("text")
    .attr("class", "team-name")
    .attr(
      "x",
      x("start") -
        startNodeRadius -
        8
    )
    .attr(
      "y",
      (team) => y(team.startRank)
    )
    .attr("text-anchor", "end")
    .attr(
      "dominant-baseline",
      "middle"
    )
    .text((team) => team.name);

  /*
   * Helpers
   */
  function getNodeKey(node) {
    return `${node.team.id}:${node.stage}`;
  }

  function getOpponentNodeKey(node) {
    if (
      node.stage === "start" ||
      node.opponentId === null
    ) {
      return null;
    }

    return `${node.opponentId}:${node.stage}`;
  }

  function getTooltipHtml(node) {
    if (node.stage === "start") {
      return `
        <strong>${node.team.name}</strong><br>
        Start Rank: ${node.rank}<br>
        Federation: ${node.team.federation}
      `;
    }

    const opponent =
      node.opponentId !== null
        ? teamsById.get(node.opponentId)
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

    if (node.status === "bye") {
      opponentText = "Bye";
    }

    if (node.status === "notPaired") {
      opponentText = "Not paired";
      scoreText = "—";
    }

    return `
      <strong>${node.team.name}</strong><br>
      Round ${node.stage}<br>
      Rank: ${node.rank}<br>
      Opponent: ${opponentText}<br>
      Score: ${scoreText}
    `;
  }

  function showTooltip(
    node,
    pageX,
    pageY
  ) {
    tooltip
      .style("display", "block")
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
    tooltip
      .style("display", "none");
  }

  /*
   * Selection이 있으면 Selection이 무조건 우선한다.
   *
   * Selection이 없을 때만 hover가 visual focus가 된다.
   */
  function getFocusNode() {
    return selectedNode ?? hoveredNode;
  }

  function renderInteractionState() {
    const focusNode =
      getFocusNode();

    const focusedTeamId =
      focusNode?.team.id ?? null;

    const opponentNodeKey =
      focusNode !== null
        ? getOpponentNodeKey(focusNode)
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
          item.team.id === focusedTeamId
      )
      .classed(
        "dimmed",
        (item) =>
          hasFocus &&
          item.team.id !== focusedTeamId
      );

    /*
     * Nodes
     */
    teamNodes
      .classed(
        "highlighted",
        (node) =>
          node.team.id === focusedTeamId
      )
      .classed(
        "opponent-highlighted",
        (node) =>
          opponentNodeKey !== null &&
          getNodeKey(node) ===
            opponentNodeKey
      )
      .classed(
        "dimmed",
        (node) =>
          hasFocus &&
          node.team.id !== focusedTeamId &&
          getNodeKey(node) !==
            opponentNodeKey
      );

    /*
     * Names
     */
    teamNames
      .classed(
        "highlighted",
        (team) =>
          team.id === focusedTeamId
      )
      .classed(
        "dimmed",
        (team) =>
          hasFocus &&
          team.id !== focusedTeamId
      );

    /*
     * pathLayer 내부에서만 순서를 변경한다.
     * node layer에는 영향 없음.
     */
    pathLayer
      .selectAll(".team-path.highlighted")
      .raise();
  }

  /*
   * Node hover
   *
   * 정확히 circle 위에 있을 때만 hoveredNode가 존재한다.
   */
  teamNodes
    .on(
      "pointerenter.hover",
      (event, node) => {
        hoveredNode = node;

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
        hoveredNode = null;

        renderInteractionState();

        /*
         * Selection이 있다면 selected 정보로 복귀.
         * 없다면 tooltip도 완전히 제거.
         */
        if (
          selectedNode !== null &&
          selectedTooltipPosition !== null
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
   * 같은 node를 다시 눌러도 해제하지 않는다.
   * 다른 node를 클릭하면 selection이 그 node로 이동한다.
   */
  teamNodes
    .on(
      "click.selection",
      (event, node) => {
        event.stopPropagation();

        selectedNode = node;

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
   * Node가 아닌 다른 곳 click
   *
   * 모든 고정 highlight 해제.
   */
  d3
    .select(document)
    .on(
      "click.clear-selection",
      () => {
        selectedNode = null;
        selectedTooltipPosition = null;

        /*
         * 클릭한 위치는 node 바깥이므로
         * hover state 역시 제거한다.
         */
        hoveredNode = null;

        hideTooltip();
        renderInteractionState();
      }
    );

  renderInteractionState();
}

main();