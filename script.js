(async function () {
  // --- Global Settings & Container Setup ---
  const trump2ndStartDate = "2025-01-20";
  const duration = 5000; // Animation duration in ms
  const barPadding = 2;
  const margin = { top: 40, right: 20, bottom: 20, left: 150 };

  // Chart container dimensions
  const container = document.getElementById("myplot");
  const plotWidth = container.clientWidth;
  const plotHeight = 800;
  const innerWidth = plotWidth - margin.left - margin.right;
  const innerHeight = plotHeight - margin.top - margin.bottom;

  // Initial heading
  document.querySelector("h2").textContent = "0 Days into Trump’s 2nd Administration";

  // Create SVG container
  const svg = d3
    .select("#myplot")
    .append("svg")
    .attr("width", plotWidth)
    .attr("height", plotHeight)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Create a group for the x-axis
  const xAxisGroup = svg.append("g").attr("class", "x-axis");

  // Tooltip
  const tooltip = d3.select("body").append("div").attr("class", "d3-tooltip").style("opacity", 0);

  // Party color mapping
  const partyColor = {
    Republican: "#2F4156", // Navy
    Democratic: "#567C9D", // Teal
    default: "#CBD9E6", // Sky fallback
  };

  // Global config object
  let dataConfig = {};

  // --- 1. Load Data ---
  async function loadData() {
    const trumpResponse = await fetch("/data/trump_executive_orders.json");
    const trumpJson = await trumpResponse.json();
    const pastResponse = await fetch("/data/past_president_executive_orders.json");
    const pastOrders = await pastResponse.json();

    // Process Trump's "2nd term" orders
    const trumpOrders = trumpJson.results.map((d) => {
      return {
        title: d.title,
        executive_order_number: d.executive_order_number,
        signing_date: d.signing_date,
        html_url: d.html_url,
        publication_date: d.publication_date,
        president: "Donald Trump 2nd",
        party: "Republican", // Ensure or adjust as needed
        start_date: trump2ndStartDate,
      };
    });

    // Days into term
    const finalDaysIntoTerm = Math.floor((new Date() - new Date(trump2ndStartDate)) / (1000 * 60 * 60 * 24));

    // Merge & compute day difference for each order
    const allOrders = trumpOrders.concat(pastOrders).map((d) => {
      d.diff = Math.floor((new Date(d.signing_date) - new Date(d.start_date)) / (1000 * 60 * 60 * 24));
      return d;
    });

    // For x-axis domain: orders within the term so far
    const finalAllData = allOrders.filter((d) => d.diff <= finalDaysIntoTerm);
    const finalCountData = d3.rollup(
      finalAllData,
      (v) => v.length,
      (d) => d.president
    );
    const finalCountArray = Array.from(finalCountData, (d) => ({ president: d[0], count: d[1] }));
    const maxCount = d3.max(finalCountArray, (d) => d.count);

    // Full list of presidents + their start dates
    const allPresidents = Array.from(
      new Set(trumpOrders.map((d) => d.president).concat(pastOrders.map((d) => d.president)))
    );
    const baseByPresident = d3.rollup(
      trumpOrders.concat(pastOrders),
      (v) => v[0].start_date,
      (d) => d.president
    );

    // Sort orders by diff ascending
    const sortedOrders = allOrders.slice().sort((a, b) => a.diff - b.diff);

    return {
      trumpOrders,
      pastOrders,
      allOrders,
      finalDaysIntoTerm,
      finalCountArray,
      maxCount,
      allPresidents,
      baseByPresident,
      sortedOrders,
    };
  }

  // --- 2. Filter Data for a given day count ---
  function filterData(sortedOrders, currentDays) {
    return sortedOrders.filter((d) => d.diff <= currentDays);
  }

  // --- 3. Visualize Data ---
  function visualizeData(currentDays, displayedOrders) {
    // Aggregate orders by president
    const newCountData = d3.rollup(
      displayedOrders,
      (v) => ({ count: v.length, start_date: v[0] ? v[0].start_date : null }),
      (d) => d.president
    );
    let newCountArray = Array.from(newCountData, (d) => ({
      president: d[0],
      count: d[1].count,
      start_date: d[1].start_date || dataConfig.baseByPresident.get(d[0]),
    }));

    // Ensure every president appears
    dataConfig.allPresidents.forEach((president) => {
      if (!newCountArray.some((obj) => obj.president === president)) {
        newCountArray.push({
          president,
          count: 0,
          start_date: dataConfig.baseByPresident.get(president),
        });
      }
    });

    // Sort descending by start_date
    newCountArray.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

    // Update Y scale domain
    dataConfig.yScale.domain(newCountArray.map((d) => d.president));

    // DATA JOIN: create/update groups for each president
    const groups = svg.selectAll(".president-group").data(newCountArray, (d) => d.president);
    const groupsEnter = groups
      .enter()
      .append("g")
      .attr("class", "president-group")
      .attr("transform", (d) => `translate(0,${dataConfig.yScale(d.president)})`);

    // President label on the left
    groupsEnter
      .append("text")
      .attr("class", "president-label")
      .attr("x", -10)
      .attr("y", dataConfig.yScale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("fill", "#2F4156")
      .text((d) => d.president);

    // Update group positions
    groupsEnter
      .merge(groups)
      .transition()
      .duration(200)
      .attr("transform", (d) => `translate(0,${dataConfig.yScale(d.president)})`);

    // For each president group, draw bars
    groupsEnter.merge(groups).each(function (groupData) {
      const orders = displayedOrders.filter((o) => o.president === groupData.president);

      // Rects
      const rects = d3
        .select(this)
        .selectAll("rect")
        .data(orders, (o) => o.executive_order_number);

      const rectsEnter = rects
        .enter()
        .append("rect")
        .attr("y", 0)
        .attr("height", dataConfig.yScale.bandwidth())
        .attr("fill", (o) => partyColor[o.party] || partyColor.default)
        .on("mouseover", function (event, o) {
          // Slightly brighten color on hover
          d3.select(this).attr("fill", d3.color(partyColor[o.party] || partyColor.default).brighter(0.5));
          tooltip.transition().duration(100).style("opacity", 1);
          tooltip.html(
            `Title: ${o.title}<br>` + `Published: ${o.publication_date}<br>` + `EO#: ${o.executive_order_number}`
          );
        })
        .on("mousemove", function (event) {
          tooltip.style("left", event.pageX + 10 + "px").style("top", event.pageY + 10 + "px");
        })
        .on("mouseout", function (event, o) {
          // Reset color
          d3.select(this).attr("fill", partyColor[o.party] || partyColor.default);
          tooltip.transition().duration(100).style("opacity", 0);
        });

      rectsEnter
        .merge(rects)
        .transition()
        .duration(0)
        .attr("x", (o, i) => dataConfig.xScale(i))
        .attr("width", dataConfig.xScale(1) - dataConfig.xScale(0) - barPadding);

      rects.exit().remove();
    });

    // Update subheading
    d3.select("#myplot").select("h3").text(`EOs per President (First ${currentDays} Days)`);

    // Update table for Trump's orders
    const filteredTrump = displayedOrders.filter((o) => o.president === "Donald Trump 2nd");
    filteredTrump.sort((a, b) => +b.executive_order_number - +a.executive_order_number);

    const tbody = d3.select("#trumpOrdersTable tbody");
    tbody.html("");
    filteredTrump.forEach((o) => {
      const row = tbody.append("tr");
      row.append("td").text(o.executive_order_number);
      row.append("td").text(o.title);
      row.append("td").text(o.signing_date);
      row.append("td").append("a").attr("href", o.html_url).attr("target", "_blank").text("View");
    });
  }

  // --- 4. Animate ---
  function animate() {
    // Create a linear interpolator from 0 to finalDaysIntoTerm
    const dayInterpolator = d3.interpolateNumber(0, dataConfig.finalDaysIntoTerm);

    // Attach a transition to any DOM element (using #myplot for convenience)
    d3.select("#myplot")
      .transition()
      .duration(duration) // same 5 seconds
      .ease(d3.easeLinear) // smooth linear pacing
      .tween("days", function () {
        // custom tween for "days"
        return function (t) {
          // t goes from 0 to 1 over 'duration' ms
          const currentDays = Math.floor(dayInterpolator(t));

          // Update your heading text
          document.querySelector("h2").textContent = `${currentDays} Days into Trump’s 2nd Administration`;

          // Filter the data for just those days
          const displayedOrders = filterData(dataConfig.sortedOrders, currentDays);

          // Re-render
          visualizeData(currentDays, displayedOrders);
        };
      });
  }

  // Main Execution
  dataConfig = await loadData();

  // Setup scales
  dataConfig.xScale = d3.scaleLinear().domain([0, dataConfig.maxCount]).range([0, innerWidth]);
  dataConfig.yScale = d3.scaleBand().range([0, innerHeight]).padding(0.1);

  // Draw x-axis at the top
  xAxisGroup.call(d3.axisTop(dataConfig.xScale).ticks(5));

  // Style x-axis lines & ticks
  xAxisGroup.selectAll(".domain").attr("stroke", "#2F4156");
  xAxisGroup.selectAll(".tick line").attr("stroke", "#CBD9E6");
  xAxisGroup.selectAll("text").attr("fill", "#2F4156").attr("font-size", "12px");

  // Kick off the animation
  animate();
})();
