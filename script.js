(async function () {
  // ------------------ Config ------------------
  const trumpSecondTermStartDate = "2025-01-20";
  const trumpSecondTermEndDate = "2029-01-20";

  // Animation speed (ms)
  const typingSpeed = 20;
  const loadingIntervalSpeed = 500;

  // Paths & URLs
  const trumpOrdersLocalPath = "data/trump_executive_orders.json";
  const pastPresidentsOrdersPath = "data/past_president_executive_orders.json";
  const externalApiUrl = "https://feed-production-dd21.up.railway.app/process";

  // ------------------ Helpers ------------------
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

  // ------------------ Data preparation ------------------
  const currentDate = new Date();
  // const currentDate = new Date("2029-01-21"); // Test date simulation

  const greetingText = getGreeting();
  const termStartDate = new Date(trumpSecondTermStartDate);
  const termEndDate = new Date(trumpSecondTermEndDate);
  const daysInOffice = getDaysBetween(termStartDate, currentDate);
  const isAfterTerm = currentDate >= termEndDate;

  // ------------------ Fetch Trump's orders ------------------
  let trumpOrders = [];
  try {
    const response = await fetch(trumpOrdersLocalPath);
    const data = await response.json();
    trumpOrders = data.results || [];
  } catch (error) {
    console.error("Error fetching Trump orders:", error);
  }

  const trumpOrderCount = trumpOrders.length;

  // ------------------ Fetch past presidents' orders ------------------
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

  // ------------------ Compose base text ------------------
  let baseText = "";

  if (isAfterTerm) {
    baseText = `
      Did you remember that Trump used to be president?
      In his second term, President Trump signed ${trumpOrderCount} executive orders.

      Let us compare his pace to that of the ten presidents before his presidency.
    `;
  } else {
    baseText = `
      Today is the ${daysInOffice} day of President Trump's second term.
      So far, he has signed ${trumpOrderCount} executive orders.

      Let us compare his pace to that of the last ten presidents.
    `;
  }

  // ------------------ Prepare the prompt for Gemini ------------------
  const apiPrompt = `
  You will be provided with:
  - Base sentences describing President Trump's second term, including the number of executive orders he signed and comparisons to past presidents.
  - Data showing the number of executive orders issued by Trump and the previous ten presidents.
  
  TASK:
  1. Rewrite or tweak the base sentences to sound more casual, conversational, and natural.
  2. Never change the number of sentences and paragraph structure.
  3. Keep each sentence close to its original length (approximately 10 to 15 words).
  4. Maintain the original meaning and key information (numbers, timelines, comparisons).
  5. Feel free to vary phrasing and tone, but the content must stay accurate.
  6. Random variation in style is encouraged to prevent repetition across different requests.
  7. For the **comparison sentence**, it must begin with a casual reaction phrase. Randomly choose one of the following openers:
     - "Hmm..."
     - "Wow..."
     - "Look at that..."
     - "Interestingly..."
     - "You know..."
     
     For example:
     - "Hmm... It looks like he's signing orders faster than most of his predecessors."
     - "Wow... He seems to be outpacing a lot of presidents before him."
  
  OUTPUT FORMAT:
  - Provide the updated text as plain text.
  - You should never say "Okay, here's the rephrased text:" or similar phrases. Just return the specified text.
  - Ensure the comparison sentence appears on its own line at the end, beginning with one of the specified openers.
  
  DATA:
  Base text:
  """
  ${baseText.trim()}
  """
  
  Executive order comparison data:
  ${JSON.stringify(combinedResults, null, 2)}
  `;

  // ------------------ Fetch rewritten text from Gemini ------------------
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

    const reactionStarters = [
      "Hmm...",
      "Wow...",
      "Look at that...",
      "Interestingly...",
      "You know...",
      "Whoa...",
      "Guess what...",
      "Surprisingly...",
    ];

    // Find the first reaction sentence in Gemini's response
    let splitIndex = -1;
    let matchedStarter = "";

    for (let starter of reactionStarters) {
      const index = fullText.indexOf(starter);
      if (index !== -1) {
        splitIndex = index;
        matchedStarter = starter;
        break;
      }
    }

    if (splitIndex !== -1) {
      rewrittenIntroText = fullText.substring(0, splitIndex).trim();
      comparisonSentence = fullText.substring(splitIndex).trim();
    } else {
      rewrittenIntroText = fullText;
      comparisonSentence = "Hmm... It looks like he's signing orders at an average pace.";
    }

    if (splitIndex !== -1) {
      rewrittenIntroText = fullText.substring(0, splitIndex).trim();
      comparisonSentence = fullText.substring(splitIndex).trim();
    } else {
      rewrittenIntroText = fullText;
      comparisonSentence = "Hmm... It looks like he's signing orders at an average pace.";
    }
  } catch (error) {
    console.error("Error fetching rewritten text from Gemini:", error);

    // Fallback text if the request fails
    rewrittenIntroText = isAfterTerm
      ? `In his second term, President Trump signed ${trumpOrderCount} executive orders.`
      : `Today is the ${daysInOffice} day of President Trump's second term.`;

    comparisonSentence = "Hmm... It looks like he's signing orders faster than most of his predecessors.";
  }

  console.log("Rewritten Intro Text:", rewrittenIntroText);
  console.log("Comparison Sentence:", comparisonSentence);

  // ------------------ Typing animation - first block ------------------
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

  // ------------------ Chart rendering ------------------
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

    typeAdditionalAnalysis(comparisonSentence);
  }

  // ------------------ Typing animation - second block (after chart) ------------------
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

  // ------------------ Start ------------------
  typeIntroText();
})();
