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

const highlightTeamName = "Marshall Islands";

async function main() {
  const data = await d3.json(DATA_URL);

  const highlightedTeam = data.teams.find(
    (team) => team.name === highlightTeamName
  );

  if (!highlightedTeam) {
    throw new Error(
        `Highlight team not found: ${highlightTeamName}`
    );
  }

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
   * 화면 표시용 위치.
   *
   * 공식 rank 자체는 변경하지 않는다.
   * 같은 rank를 가진 팀들은 별도의 displaySlot에 배치해서
   * 노드가 서로 겹치지 않도록 한다.
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
        result: null,
      },
      ...data.rounds.map((roundNumber) => {
        const round = roundsByNumber.get(roundNumber);

        if (!round) {
          return {
            stage: roundNumber,
            rank: null,
            displaySlot: null,
            result: null,
          };
        }

        return {
          stage: roundNumber,
          rank: round.rank,
          displaySlot: displaySlots.get(
            `${roundNumber}:${team.id}`
          ),
          result: round.result,
        };
      }),
    ];

    return {
      team,
      points,
    };
  });

  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

  svg
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

  svg
    .selectAll(".stage-label")
    .data(stages)
    .join("text")
    .attr("class", "stage-label")
    .attr("x", (stage) => x(stage.key))
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .text((stage) => stage.label);

  const line = d3
    .line()
    .defined(
      (point) => point.displaySlot !== null
    )
    .x((point) => x(point.stage))
    .y((point) => y(point.displaySlot))
    .curve(d3.curveBumpX);

  const teamPaths = svg
    .selectAll(".team-path")
    .data(paths)
    .join("path")
    .attr("class", (item) =>
      item.team.id === highlightedTeam.id
        ? "team-path highlighted"
        : "team-path"
    )
    .attr("d", (item) => line(item.points));
  
  teamPaths
    .filter(
        (item) => item.team.id === highlightTeamName.id
    )
    .raise();

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

svg
  .selectAll(".team-node")
  .data(nodes)
  .join("circle")
  .attr("class", (node) =>
    node.team.id === highlightedTeam.id
      ? "team-node highlighted"
      : "team-node"
    )
  .attr("cx", (node) => x(node.stage))
  .attr("cy", (node) => y(node.displaySlot))
  .attr("r", (node) =>
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

  svg
    .selectAll(".team-name")
    .data(data.teams)
    .join("text")
    .attr("class", (team) =>
      team.id === highlightedTeam.id
        ? "team-name highlighted"
        : "team-node"
    )
    .attr(
    "x",
    x("start") - startNodeRadius - 8
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
}

main();