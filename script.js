(async function () {
  // Config
  const trumpSecondTermStartDate = "2025-01-20";

  // Animation speed (ms)
  const typingSpeed = 20;
  const loadingIntervalSpeed = 500;

  // Paths & URLs
  const trumpOrdersApiUrl =
    "https://www.federalregister.gov/api/v1/documents?conditions%5Bcorrection%5D=0&conditions%5Bpresident%5D=donald-trump&conditions%5Bpresidential_document_type%5D=executive_order&conditions%5Bsigning_date%5D%5Bgte%5D=01%2F20%2F2025&conditions%5Bsigning_date%5D%5Blte%5D=03%2F25%2F2025&conditions%5Btype%5D%5B%5D=PRESDOCU&fields%5B%5D=citation&fields%5B%5D=document_number&fields%5B%5D=end_page&fields%5B%5D=html_url&fields%5B%5D=pdf_url&fields%5B%5D=type&fields%5B%5D=subtype&fields%5B%5D=publication_date&fields%5B%5D=signing_date&fields%5B%5D=start_page&fields%5B%5D=title&fields%5B%5D=disposition_notes&fields%5B%5D=executive_order_number&fields%5B%5D=not_received_for_publication&fields%5B%5D=full_text_xml_url&fields%5B%5D=body_html_url&fields%5B%5D=json_url&format=json&include_pre_1994_docs=true&order=executive_order&page=1&per_page=1000";

  const trumpOrdersLocalPath = "data/trump_executive_orders.json";
  const pastPresidentsOrdersPath = "data/past_president_executive_orders.json";
  const externalApiUrl = "https://feed-production-dd21.up.railway.app/process";

  // Helpers
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 18) return "Good afternoon";
    return "Good evening";
  }

  function getDaysBetween(date1, date2) {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((date2 - date1) / msPerDay);
  }

  async function fetchAllPaginatedResults(url) {
    let currentUrl = url;
    let results = [];

    try {
      while (currentUrl) {
        console.log(`Fetching: ${currentUrl}`);
        const response = await fetch(currentUrl);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        if (Array.isArray(data.results)) {
          results = results.concat(data.results);
        }

        currentUrl = data.next_page_url || null;
      }

      console.log("Fetched all results:", results);
      return results;
    } catch (error) {
      console.error("Error fetching data:", error);
      return [];
    }
  }

  // Data preparation
  const currentDate = new Date();
  const greetingText = getGreeting();
  const termStartDate = new Date(trumpSecondTermStartDate);
  const daysInOffice = getDaysBetween(termStartDate, currentDate);

  // Fetch Trump's orders
  let trumpOrders = [];
  try {
    // trumpOrders = await fetchAllPaginatedResults(trumpOrdersApiUrl);
    const response = await fetch(trumpOrdersLocalPath);
    const data = await response.json();
    trumpOrders = data.results || [];
  } catch (error) {
    console.error("Error fetching Trump orders:", error);
  }

  const trumpOrderCount = trumpOrders.length;

  // Fetch past presidents' orders
  let pastPresidentsOrders = [];
  try {
    const response = await fetch(pastPresidentsOrdersPath);
    const data = await response.json();
    pastPresidentsOrders = data.results || data;
  } catch (error) {
    console.error("Error fetching past presidents' data:", error);
  }

  const comparablePastOrders = pastPresidentsOrders.filter((order) => {
    const termStart = new Date(order.start_date);
    const signingDate = new Date(order.signing_date);
    return getDaysBetween(termStart, signingDate) <= daysInOffice;
  });

  const pastPresidentsCounts = d3.rollup(
    comparablePastOrders,
    (orders) => orders.length,
    (order) => order.president
  );

  const combinedResults = [
    { president: "Donald Trump 2nd", count: trumpOrderCount },
    ...Array.from(pastPresidentsCounts, ([president, count]) => ({
      president,
      count,
    })),
  ];

  const apiPrompt = `Trump's 2nd days in office: ${daysInOffice}\nresult: ${JSON.stringify(combinedResults)}`;

  console.log(apiPrompt);

  // Fetch additional analysis text
  let additionalAnalysis = "";
  try {
    const response = await fetch(externalApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: apiPrompt }),
    });
    const data = await response.json();
    additionalAnalysis = (data.response || "").trim();
  } catch (error) {
    console.error("Error fetching external analysis:", error);
  }

  // Typing animation - first block
  const firstTypedTextEl = document.getElementById("typedText");
  firstTypedTextEl.textContent = "";

  const introText = `
${greetingText}, America.
Today is the ${daysInOffice} day of President Trump's second term.

So far, he has signed ${trumpOrderCount} executive orders.
Let us compare his pace to that of the last ten presidents.`;

  let introCharIndex = 0;
  function typeIntroText() {
    if (introCharIndex < introText.length) {
      const currentChar = introText.charAt(introCharIndex);
      firstTypedTextEl.innerHTML += currentChar === "\n" ? "<br>" : currentChar;
      introCharIndex++;
      setTimeout(typeIntroText, typingSpeed);
    } else {
      showLoadingDots();
    }
  }

  function showLoadingDots() {
    let dotCount = 0;
    const loadingInterval = setInterval(() => {
      dotCount = (dotCount + 1) % 4;
      firstTypedTextEl.innerHTML = introText.split("\n").join("<br>") + "<br><br><br>Loading" + ".".repeat(dotCount);
    }, loadingIntervalSpeed);

    setTimeout(() => {
      clearInterval(loadingInterval);
      firstTypedTextEl.innerHTML = introText.split("\n").join("<br>");
      renderChart();
    }, 3000);
  }

  // Chart rendering
  function renderChart() {
    const chartContainer = document.getElementById("chartContainer");
    chartContainer.innerHTML = "";

    const maxOrderCount = d3.max(combinedResults, (d) => d.count);

    function createChartRow(president, count) {
      const row = document.createElement("div");
      row.className = "chart-row";

      const label = document.createElement("span");
      label.className = "president-label";
      label.textContent = president;
      row.appendChild(label);

      const barContainer = document.createElement("div");
      barContainer.className = "bar-container";

      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.width = maxOrderCount ? (count / maxOrderCount) * 100 + "%" : "0%";

      barContainer.appendChild(bar);
      row.appendChild(barContainer);

      const countLabel = document.createElement("span");
      countLabel.className = "count-label";
      countLabel.textContent = count;
      row.appendChild(countLabel);

      return row;
    }

    combinedResults.forEach((entry) => {
      chartContainer.appendChild(createChartRow(entry.president, entry.count));
    });

    typeAdditionalAnalysis(additionalAnalysis);
  }

  // Typing animation - second block
  function typeAdditionalAnalysis(text) {
    const secondTypedTextEl = document.getElementById("typedText2");
    secondTypedTextEl.textContent = "";

    let charIndex = 0;
    function typeNextChar() {
      if (charIndex < text.length) {
        const currentChar = text.charAt(charIndex);
        secondTypedTextEl.innerHTML += currentChar === "\n" ? "<br>" : currentChar;
        charIndex++;
        setTimeout(typeNextChar, typingSpeed);
      }
    }
    typeNextChar();
  }

  // Start
  typeIntroText();
})();
