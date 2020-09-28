
/** Handles the league change and displaying data.
 */
function displayGames() 
{
	// Get the text value of the league/week for API use
	let leagueSelector = document.getElementById('league-select');
	let leagueValue = leagueSelector.options[leagueSelector.selectedIndex].text;

	let weekSelector= document.getElementById('week-select');
	let weekValue = weekSelector.options[weekSelector.selectedIndex].text;

	// API Setup
	let apiString = `https://api.collegefootballdata.com/lines?year=2020&week=${weekValue}&seasonType=regular&conference=${leagueValue}`;
	console.log(apiString);

	fetch(apiString)
		.then(response => response.json())
		.then(data => {
			appendGameDataNodes(data);
		});
}

/** Handles the actual creation of child nodes and 
 *  adds them to the HTML document.
 */
function appendGameDataNodes(data) 
{
	let gameDisplay = document.getElementById("games-display");
	while (gameDisplay.firstChild)
	{
		gameDisplay.firstChild.remove();
	}

	for (let i = 0; i < data.length; i++)
	{
		// Text Area
		let homeTeam = data[i].homeTeam;
		let awayTeam = data[i].awayTeam;
		let spread = data[i].lines[0].formattedSpread;
		let p = document.createElement("P");
		let bold = document.createElement('strong');
		let teamsNode = document.createTextNode(`${homeTeam} - ${awayTeam}`)
		let spreadNode = document.createTextNode(` :: ${spread}`);
		bold.appendChild(teamsNode);
		p.appendChild(bold);
		p.appendChild(spreadNode);
		p.setAttribute('id', spread.replace(/\s/g, '|'));
		gameDisplay.appendChild(p);

		// Betting Controls
		


	}
}