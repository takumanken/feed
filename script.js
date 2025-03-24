(async function () {
  // Config
  const trumpSecondTermStartDate = "2025-01-20";
  const trumpSecondTermEndDate = "2029-01-20";

  const typingSpeed = 20;
  const loadingIntervalSpeed = 500;

  const trumpOrdersApiUrl =
    "https://www.federalregister.gov/api/v1/documents?conditions%5Bcorrection%5D=0&conditions%5Bpresident%5D=donald-trump&conditions%5Bpresidential_document_type%5D=executive_order&conditions%5Bsigning_date%5D%5Bgte%5D=01%2F20%2F2025&conditions%5Bsigning_date%5D%5Blte%5D=03%2F25%2F2025&conditions%5Btype%5D%5B%5D=PRESDOCU&fields%5B%5D=citation&fields%5B%5D=document_number&fields%5B%5D=end_page&fields%5B%5D=html_url&fields%5B%5D=pdf_url&fields%5B%5D=type&fields%5B%5D=subtype&fields%5B%5D=publication_date&fields%5B%5D=signing_date&fields%5B%5D=start_page&fields%5B%5D=title&fields%5B%5D=disposition_notes&fields%5B%5D=executive_order_number&fields%5B%5D=not_received_for_publication&fields%5B%5D=full_text_xml_url&fields%5B%5D=body_html_url&fields%5B%5D=json_url&format=json&include_pre_1994_docs=true&order=executive_order&page=1&per_page=1000";

  const trumpOrdersLocalPath = "data/trump_executive_orders.json";
  const pastPresidentsOrdersPath = "data/past_president_executive_orders.json";
  const externalApiUrl = "https://feed-production-dd21.up.railway.app/process";

  const REACTION_STARTERS = [
    "Hmm...",
    "Wow...",
    "Look at that...",
    "Interestingly...",
    "You know...",
    "Whoa...",
    "Guess what...",
    "Surprisingly...",
  ];

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

  async function fetchTrumpOrdersFromAPI(initialUrl) {
    let currentUrl = initialUrl;
    let allResults = [];

    try {
      while (currentUrl) {
        console.log(`Fetching: ${currentUrl}`);
        const response = await fetch(currentUrl);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (Array.isArray(data.results)) {
          allResults = allResults.concat(data.results);
        }

        currentUrl = data.next_page_url || null;
      }

      console.log("Fetched all Trump executive orders:", allResults);
      return allResults;
    } catch (error) {
      console.error("Error fetching Trump orders from API:", error);
      return [];
    }
  }

  const currentDate = new Date();
  // const currentDate = new Date("2029-01-21");

  const greetingText = getGreeting();
  const termStartDate = new Date(trumpSecondTermStartDate);
  const termEndDate = new Date(trumpSecondTermEndDate);
  const daysInOffice = getDaysBetween(termStartDate, currentDate);
  const isAfterTerm = currentDate >= termEndDate;

  let trumpOrders = [];
  try {
    // Use live API
    trumpOrders = await fetchTrumpOrdersFromAPI(trumpOrdersApiUrl);

    // Use local JSON for testing
    // const response = await fetch(trumpOrdersLocalPath);
    // const data = await response.json();
    // trumpOrders = data.results || [];

    if (trumpOrders.length === 0) {
      throw new Error("Trump orders fetch returned empty.");
    }
  } catch (error) {
    console.error("Error fetching Trump orders:", error);
    displayServiceUnavailable();
    return;
  }

  const trumpOrderCount = trumpOrders.length;

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

  let baseText = "";

  if (isAfterTerm) {
    baseText = `
Did you remember that Trump used to be president?
In his second term, President Trump signed ${trumpOrderCount} executive orders.\n
Let us compare his pace to that of the ten presidents before his presidency.
    `;
  } else {
    baseText = `
Today is the ${daysInOffice} day of President Trump's second term.
So far, he has signed ${trumpOrderCount} executive orders.\n
Let us compare his pace to that of the last ten presidents.
`;
  }

  const reactionStarterList = REACTION_STARTERS.map((starter) => `- "${starter}"`).join("\n     ");

  const apiPrompt = `
  You will be provided with:
  - Base sentences describing President Trump's second term, including the number of executive orders he signed and comparisons to past presidents.
  - Data showing the number of executive orders issued by Trump and the previous ten presidents.
  
  TASK:
  1. Rewrite or tweak the base sentences to sound more casual, conversational, and natural like TV news.
  2. Never change the number of sentences and paragraph structure.
  3. Keep each sentence close to its original length (approximately 10 to 15 words).
  4. Maintain the original meaning and key information (numbers, timelines, comparisons).
  5. Feel free to vary phrasing and tone, but the content must stay accurate.
  6. Random variation in style is encouraged to prevent repetition across different requests.
  7. For the comparison sentence, it must begin with a casual reaction phrase. Randomly choose one of the following openers:
     ${reactionStarterList}
  
  OUTPUT FORMAT:
  - Provide the updated text as plain text.
  - Do not include any explanations or introductory remarks.
  - Ensure the comparison sentence appears on its own line at the end, beginning with one of the specified openers.
  
  DATA:
  Base text:
  """
  ${baseText.trim()}
  """
  
  Executive order comparison data:
  ${JSON.stringify(combinedResults, null, 2)}
  `;

  let rewrittenIntroText = "";
  let comparisonSentence = "";

  try {
    const response = await fetch(externalApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: apiPrompt }),
    });
    const data = await response.json();
    const fullText = (data.response || "").trim();

    let splitIndex = -1;

    for (let starter of REACTION_STARTERS) {
      const index = fullText.indexOf(starter);
      if (index !== -1) {
        splitIndex = index;
        break;
      }
    }

    if (splitIndex !== -1) {
      rewrittenIntroText = fullText.substring(0, splitIndex).trim();
      comparisonSentence = fullText.substring(splitIndex).trim();
    } else {
      rewrittenIntroText = fullText;
      comparisonSentence = `${REACTION_STARTERS[0]} It looks like he's signing orders at an average pace.`;
    }
  } catch (error) {
    console.error("Error fetching rewritten text from Gemini:", error);
    displayServiceUnavailable();
    return;
  }

  function displayServiceUnavailable() {
    const firstTypedTextEl = document.getElementById("typedText");
    const chartContainer = document.getElementById("chartContainer");
    const secondTypedTextEl = document.getElementById("typedText2");

    firstTypedTextEl.innerHTML = "🚧 This website is temporarily out of service. 🚧";
    chartContainer.innerHTML = "";
    secondTypedTextEl.innerHTML = "";
  }

  console.log("Rewritten Intro Text:", rewrittenIntroText);
  console.log("Comparison Sentence:", comparisonSentence);

  const firstTypedTextEl = document.getElementById("typedText");
  firstTypedTextEl.textContent = "";

  const introText = `${greetingText}, America.\n\n${rewrittenIntroText}`;

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

    typeComparisonSentence(comparisonSentence);
  }

  function typeComparisonSentence(text) {
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

  typeIntroText();
})();
