
document.addEventListener("DOMContentLoaded", function() {
     /*
     * Check to see if browser supports IndexedDb
     */
     window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
     window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
     window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
     if(!window.indexedDB){           
            (new DatabaseManager()).renderMessage('error', "Please use a modern browser (2)");
            
            return false;
     } else {
        /*
        * We start the game
        */
        (new TicTacToe()).startGame('');
     }
     
     /*
     * Initiate reset
     */
     document.querySelector('#resetBtn').addEventListener('click', function () {
            let warning = confirm("Resetting will remove all of your games.  Are you sure?");
            if (warning == true) {
                (new DatabaseManager()).clearDatabase('');
            }
     });
});

const WIN        = 1, // Flag for a win
      LOSS       = 0, // Flag for a loss
      TIE        = 2, // Flag for a tie
      X          = 'x', // Player x flag
      O          = 'o', // Player o flag
      X5         = 'x5', // 5x5 game board
      X3         = 'x3', // 3x3 game board
      // Object saved in indexedDb per game
      GAMES_OBJ  = {
        'whoStarted': '',
        'winLossTieFlag': '',
        'winner': '',
        'dateTimeStamp': '',
        'movesArray': [],
        'winPattern': []
      };

/**
* Global changeable variables
*/
class Flags {
    static turn           = 1; // Whose turn
    static whoStarted     = ''; // Captures who started
    // Application analysis of game
    static gameProperties = {
        "numberOfSpacesToWin": 0,
        "winningMoves": []
    };
}

/**
* This class is the base component for components of the AnalyzeData class.
* It holds all methods that are used by both the BlockMove and WinMove classes.
*/
class BaseMove {
    /**
    * Get the current moves played
    */
    getMoves(player) {
        // 1. get only the player's moves from GAMES_Obj
        let array     = [];
        GAMES_OBJ.movesArray.map(function (value, index) {
            if (player === value.player) {
                array.push(value.space);
            }
        }, player); 
        
        return array;
    }
    
    /**
    * Create frequencies for each move
    */
    createMoveFrequencies(moves) {
        let obj = {};
        moves.forEach(function(i) { 
            obj[i] = (obj[i] || 0) + 1;
        });
        
        return obj;
    }
    
    /**
    * Iterate over win patterns and compare the other player's current moves.
    * Save any win pattern where other player already has two spaces chosen.
    */
    getProjectedWinMoves(winningSpaces, opponentsMovesBase) {
        let array = [];  
        winningSpaces.map(function (value, index) {
            let count = 0;
            for (let i = 0; i < value.length; i++) {
                if (opponentsMovesBase.includes(value[i])) {
                    count = count + 1;                    
                }  
                                      
                if (2 === count) {
                    array.push(value);
                }                   
            }
        });

        return array;
    }
    
    /**
    * Iterate over the list of win patterns that the other player could use in their next move.
    * Choose a space in the win pattern that the other player hasn't chosen yet, and then choose that move.
    */
    getPlayableSpaceFromWinMoves(projectedWin) {
        let move = false;
        if (projectedWin.length > 0) {
            // find space that is available in projectedwin
            projectedWin.map(function (value, index) {
                for (let i = 0; i < value.length; i++) {
                    if ("&nbsp;" === document.querySelector('#' + value[i]).innerHTML) {
                        move = value[i];
                        break;
                    }
                }
            });
        }
        
        return move;
    }
    
    /**
    * Iterate over data to get wins
    */
    processDataToGetWinPattern(obj) {
        // Get win patterns
        this.data.map(function (value, index) {
            obj = this.getWinPatterns(value, obj);
        }, this);
        
        return obj;
    }
}

/**
* This class is a component of the AnalyzeData class.
* It holds all methods for player O to choose the best first move.
*/
class FirstMove extends BaseMove {
    /**
    * Data from indexedDB
    */
    constructor(data) {
        super();
        this.data = data;
    }
    
    /**
    * Call each method to choose the first move.
    */
    chooseFirstMove() {
        // Assure that there is data to use
        if (0 === GAMES_OBJ.movesArray.length) {
            let spaces            = this.processDataToGetFirstMove([]); // Get all first moves from every win or tied game.
            let spacesWithWeights = this.createMoveFrequencies(spaces); // Count and save all occurrence of each move to get their frequencies.
            let spaceChoices      = this.orderMovesFromHighestToLowestWeight(spacesWithWeights); // Order the frequencies from highest to lowest.
    
            return spaceChoices[0].split('_')[1]; // Choose the first move with the highest frequency.
        }
        
        return false;
    }
    
    /**
    * Iterate through the data
    */
    processDataToGetFirstMove(obj) {
        let middelMove = 'r2c2';
        this.data.map(function (value, index) {
            if (value.winPattern.length > 3) {
                middelMove = 'r3c3';
            }
            obj = this.getFirstMovesFromWinningGames(obj, value);
        }, this);
 
        // If, for some reason, app wins the first game, then the app will need a start move.
        // At this point, there isn't any data to analyze, so we'll start the app in the middle.
        if (0 === obj.length) {
            obj.push(middelMove); 
        }
        
        return obj;
    }
    
    /**
    * Order the frequencies from highest to lowest.
    */
    orderMovesFromHighestToLowestWeight(spacesWithWeights) {
        let array = [];
        for (const [key, value] of Object.entries(spacesWithWeights)) {
            array.push(`${value}_${key}`);
        }
        array.sort();
        
        return array;
    }
    
    /**
    *  Get only the first move from each game played
    */
    getFirstMovesFromWinningGames(spaces, value) {
        let finishTypes = [1,2];
        let winOrTie    = ["", value.movesArray[0].player];
        if (finishTypes.includes(value.winLossTieFlag)
                && 1 === value.movesArray[0].order
                && winOrTie.includes(value.winner) 
            ) {
            spaces.push(value.movesArray[0].space);
        }
        
        return spaces;
    }
}

/**
* This class is a component of the AnalyzeData class.
* It holds all methods for player O to block player X.
*/
class BlockMove extends BaseMove {
    /**
    * Data from indexedDB
    */
    constructor(data) {
        super();
        this.data = data;
    }
    
    /**
    * Choose a blocking move
    */
    blockMove() {
        let winningSpaces      = Flags.gameProperties.winningMoves; // Get win patterns
        let opponentsMovesBase = this.getMoves(X); // Get other player's current moves
        let projectedWin       = this.getProjectedWinMoves(winningSpaces, opponentsMovesBase); // Get potential wins from win patterns        
        // Choose an available space from the potential wins to block the other player  
        return this.getPlayableSpaceFromWinMoves(projectedWin); 
    }
}

/**
* This class is a component of the AnalyzeData class.
* It holds all methods for player O to win.
*/
class WinMove extends BaseMove {
    /**
    * Data from indexedDB
    */
    constructor(data) {
        super();
        this.data = data;
    }
    
    /**
    * Choose a win move
    */
    winMove() {
        let computerMovesBase = this.getMoves(O); // Get all current moves from player O (computer)
        let winningSpaces     = Flags.gameProperties.winningMoves; // Get win patterns 
        let projectedWin      = this.getProjectedWinMoves(winningSpaces, computerMovesBase); // Get potential wins from win patterns    
        // Choose an available space from the potential wins to win  
        return this.getPlayableSpaceFromWinMoves(projectedWin); 
    }
}

/**
* This class is a component of the AnalyzeData class.
* It holds all methods for player O to make a move if they cannot win or block.
*/
class BestMove extends BaseMove {
    /**
    * Data from indexedDB
    */
    constructor(data) {
        super();
        this.data = data;
    }
    
    /**
    * Choose the best available move
    */
    bestMove() {
        let spaces = this.getPotentialNextSpaces(); // Get spaces that can be played based on wins and ties 
        if (0 === spaces.length) {
            return false;
        }
        let lossSpaces              = this.getLossPatterns(); // Get patterns of losses
        let avoidedSpaces           = this.getPotentialLossSpaces(lossSpaces); // list spaces to avoid during a current move
        let avoidedSpacesWithWeight = this.createMoveFrequencies(avoidedSpaces); // Get the frequency of the moves to avoid
        let orderSpacesToAvoid      = this.orderWeightedMovesFromHighestToLowest(avoidedSpacesWithWeight); // Order the frequencies of each move
        let spacesWithWeights       = this.createMoveFrequencies(spaces); // Get the frequency of playable moves from previous win and tie games
        let spaceChoices            = this.orderWeightedMovesFromHighestToLowest(spacesWithWeights); // Order the frequencies of each move
        
        // Choose the first with the highest frequency that isn't a move to avoid
        return this.getFirstAvailableMoveWithHighestWeight(spaceChoices, orderSpacesToAvoid[0]);       
    }
    
    /**
    * Iterate over data to get losses
    */
    getLossPatterns(orderAfterPrevMove) {
        let losingSpaces = [];
        this.data.map(function (value, index) {
            let array = [];
            let loser = O;
            if (O === value.winner) {
                loser = X;
            }            
            for (let i = 0; i < value.movesArray.length; i++) {
                if (loser === value.movesArray[i].player) {
                    array.push(value.movesArray[i].space);
                }
            }     
            
            losingSpaces.push(array);       
        });
        
        return losingSpaces;
    }
    
    /**
    * Get past loss spaces based on current moves
    */
    getPotentialLossSpaces(lossSpaces) {
        let currentMoves  = this.getMoves(O);
        let numberOfMoves = currentMoves.length;
        let matches       = [];
        let array         = [];
        lossSpaces.map(function (value, index) {
            let count = 0;
            for (let i = 0; i <= numberOfMoves; i++) {
                if (
                    typeof currentMoves[i] !== "undefined" 
                    && typeof value[i] !== "undefined" 
                    && currentMoves[i] === value[i]) {
                    count = count + 1;
                }
                
                if (count === numberOfMoves) {
                    matches.push(value[i]);
                }
            }
        });
        
        return matches;
    }
    
    /**
    * Get potential spaces to choose from past win and tie games
    */
    getPotentialNextSpaces() {
        let previousMove       = GAMES_OBJ.movesArray[GAMES_OBJ.movesArray.length - 1];
        let orderAfterPrevMove = previousMove.order + 1;
        let finishTypes        = [1,2];
        let spaces             = [];
        this.data.map(function (value, index) {
            if (typeof value.movesArray[previousMove.order] !== "undefined") {
                if (finishTypes.includes(value.winLossTieFlag)
                    && orderAfterPrevMove === value.movesArray[previousMove.order].order
                    && value.winner === value.movesArray[previousMove.order].player
                ) {
                    spaces.push(value.movesArray[previousMove.order].space);
                }
            }
        });
        
        return spaces;
    }
    
    /**
    * Order frequencies from highest to lowest
    */
    orderWeightedMovesFromHighestToLowest(spacesWithWeights) {
        let array = [];
        for (const [key, value] of Object.entries(spacesWithWeights)) {
            array.push(`${value}_${key}`);
        }
        
        return array.sort().reverse();
    }
    
    /**
    * Choose the move with the highest weight and not a move to avoid
    */
    getFirstAvailableMoveWithHighestWeight(spaceChoices, spaceToAvoid) {
        let move = false;
        if (typeof spaceToAvoid !== "undefined") {
            spaceToAvoid = spaceToAvoid.split("_")[1];
        }
        
        if (spaceChoices.length > 0) { 
            let tictactoe = new TicTacToe();
            for (let i = 0; i < spaceChoices.length; i++) {
                let moveCheck = spaceChoices[i].split('_')[1];
                let space = document.querySelector('#' + moveCheck);
                if (false === tictactoe.isPlayed(space)
                    && moveCheck !== spaceToAvoid) { 
                    move = moveCheck;
                    break;
                }
            }
        }
        
        return move;
    }
}

/**
* This class has all of the actions for the app, player O, to choose a move based on data
*/
class AnalyzeData {
    // data from indexedDb
    constructor(data) {
        this.data = data;
    }
    
    /**
    * Player O will:
    * 1. find the best starting move, if starting a game
    * 2. choose a winning move, if not starting
    * 3. choose a blocking move, if no winning move is available
    * 4. choose the best move, if no blocking move is needed
    */
    initializeAnalysis() {
        this.inferAllWinPossibilties();
        // Player O starts
        let result = (new FirstMove(this.data)).chooseFirstMove();
        if (false !== result) {
            return result;
        }
        // Player O checks for a win based on past win patterns
        result = (new WinMove(this.data)).winMove();
        if (false !== result) {
            return result;
        }
        // Player O checks for a blocking move based on past game patterns
        result = (new BlockMove(this.data)).blockMove();
        if (false !== result) {
            return result;
        }
        
        // Player O chooses a move with the highest frequency, based on their current move
        return (new BestMove(this.data)).bestMove();
    }
    
    /**
    * Based on game board spaces, player O can infer all winning patterns
    */
    inferAllWinPossibilties() {
        if (0 === Flags.gameProperties.winningMoves.length) {
            let count    = this.getCountOfGameBoardSpaces();
            let rowsCols = this.getNumberOfRowsAndCols(count);
            this.getWinsByRowAndColPatterns("row", "r", "c");
            this.getWinsByRowAndColPatterns("col", "c", "r");
            this.getWinsByDiagnols(0);
            this.getWinsByDiagnols(1);
        }
    }
    
    /**
    * Count all spaces on the game board
    */
    getCountOfGameBoardSpaces() {
        let count = 0;
        for (const space of document.querySelectorAll(".tttGameBoardTd")) {
            count = count + 1;
        }
        
        return count;
    }
    
    /**
    * Count number of rows and columns (will be same number)
    */
    getNumberOfRowsAndCols(count) {
        let rowsCols = 0;
        for (let i = 0; i <= count; i++) {
            if (i * i === count) {
                rowsCols = i;
                break;
            }
        }
        
        Flags.gameProperties.numberOfSpacesToWin = rowsCols;
    }
   
    /**
    * Determine diagnol wins
    */
    getWinsByDiagnols(flag) {
        let eachArray = [];
        for (let i = 0; i <= Flags.gameProperties.numberOfSpacesToWin; i++) {
            let numR = i;
            let numC = i;
            if (1 === flag) {
                numC = (Flags.gameProperties.numberOfSpacesToWin + 1 - i);
            }
            if (0 !== numR) {
                let row = "r" + numR;
                let col = "c" + numC;
                eachArray.push(row + col);
            }
        }
        Flags.gameProperties.winningMoves.push(eachArray);
    }
    
    /**
    * Determine row and column wins
    */
    getWinsByRowAndColPatterns(type, s1, s2) {
        let array = [];
        for (let rc1 = 1; rc1 <= Flags.gameProperties.numberOfSpacesToWin; rc1++) {
            let eachArray = [];
            let v1        = s1 + rc1;
            for (let rc2 = 1; rc2 <= Flags.gameProperties.numberOfSpacesToWin; rc2++) {
                let v2    = s2 + rc2;
                let value = v1 + v2;
                if ("col" === type) {
                    value = v2 + v1;
                }
                eachArray.push(value);
            }
            Flags.gameProperties.winningMoves.push(eachArray);
        }
    }
}

/**
* This class performs all data store actions
*/
class DatabaseManager {
    /**
    * Initialize the storage
    */
    initializeDb() {
        let request = window.indexedDB.open("ticTacToe", 1);

        request.onerror = function(){
            window.indexedDB.deleteDatabase("ticTacToe");
            this.renderMessage('error', "Db request error (1)");
        };

        request.onupgradeneeded = function(event) {
            if (Number(event.oldVersion) > 0
                && (
                    Number(event.oldVersion) !== Number(1)
                )
            ) {
                window.indexedDB.deleteDatabase("ticTacToe");
            } else {
                let db    = request.result;
                let store = db.createObjectStore(
                    "objectStore",
                    {keyPath: "id", autoIncrement: true}
                );				
				store.createIndex("winLossTieFlag", "winLossTieFlag", {unique: false});
				store.createIndex("winner", "winner", {unique: false});
            }
        };

        return request;
    }
    
    /**
    * Clear store on reset
    */
    clearDatabase(flag) {
		let databaseManager = new DatabaseManager();
        let open            = this.initializeDb();
        open.onsuccess = function() {
            let resources = databaseManager.dbResources(open);
            resources.store.clear();
            let ticTacToe = new TicTacToe();
            ticTacToe.clearBoard();
            Flags.turn               = 1;
            Flags.whoStarted         = '';
            GAMES_OBJ.whoStarted     = '';
            GAMES_OBJ.winLossTieFlag = '';
            GAMES_OBJ.winner         = '';
            GAMES_OBJ.dateTimeStamp  = '';
            GAMES_OBJ.movesArray     = [];
            ticTacToe.startGame(flag);
        };

        open.onerror = function() {
            databaseManager.renderMessage('error', 'could not clear database (4)');
            return false;
        };
    }
    
    /**
    * Render tallies from store values
    */
    showTallies(data) {
        this.totalGamesPlayed(data);     
        this.totalWins(data, X, 'xWins');        
        this.totalWins(data, O, 'oWins');        
        this.totalWins(data, '', 'ties');
        
        return this.startingPlayer(data);         
    }
    
    /**
    * Check to see who should start based on last game saved in the store
    */
    startingPlayer(data) {
        let playerToStartGame = X;
        let gameBoardType     = X3;
        if (data.length > 0) {
            let lastPlayer = data[data.length - 1].whoStarted;
            if (X === lastPlayer) {
                playerToStartGame = O;
            }
            
            if (5 === data[data.length - 1].winPattern.length) {
                gameBoardType = X5;
            }
        } else {
            let count = 0;
            for (const space of document.querySelectorAll(".tttGameBoardTd")) {
                count = count + 1;
            }
            if (25 === count) {
                gameBoardType = X5;
            }
        }
        
        return [
            playerToStartGame,
            gameBoardType
        ];
    }
    
    /**
    * Get total wins
    */
    totalWins(data, who, id) {
        let array = [];
        data.map(function (value, index) {
            if (who === value.winner) {
                array.push(1);
            }
        });
        
        document.querySelector('#' + id).innerHTML = array.length;
    }
    
    /**
    * Get total games played
    */
    totalGamesPlayed(data) {
        document.querySelector('#gPlays').innerHTML = data.length;
    }
    
    /**
    * Create object with game data, and then save it
    */
    saveGame(winningSpaces) {
        let obj = {
            whoStarted: Flags.whoStarted,
            winLossTieFlag: GAMES_OBJ.winLossTieFlag,
            winner: GAMES_OBJ.winner,
            dateTimeStamp: GAMES_OBJ.dateTimeStamp,
            movesArray: GAMES_OBJ.movesArray,
            winPattern: winningSpaces
        };
        this.idbSave(obj);
    }
    
    /**
    * Save the game in indexedDB
    */
    idbSave(obj) {
        let databaseManager = new DatabaseManager();
        let open            = this.initializeDb();
        open.onsuccess = function() {
            let resources = databaseManager.dbResources(open);
            let request   = resources.store.add(obj);
            request.onsuccess = function(event) {
                GAMES_OBJ.whoStarted     = '';
                GAMES_OBJ.winLossTieFlag = '';
                GAMES_OBJ.winner         = '';
                GAMES_OBJ.dateTimeStamp  = '';
                GAMES_OBJ.movesArray     = [];
            };
            databaseManager.storageTransactionComplete(resources);
        };

        open.onerror = function() {
            databaseManager.renderMessage('error', 'game save error (3)');
            return false;
        };
    }
    
    /**
    * Get all data in the store
    */
    idbGetAll() {
        return new Promise((resolve, reject) => {
            let databaseManager = new DatabaseManager();
            let open = this.initializeDb();
            open.onsuccess = function() {
                let resources    = databaseManager.dbResources(open);
			    let records      = [];
                let getAll       = resources.store.openCursor(null);
                getAll.onsuccess = function(event) {
                    var cursor = event.target.result;
                    if (cursor) {
					    records.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(records);
                   
                        return false;
                    }
                };
            };
            
            open.onerror = function() {
                databaseManager.renderMessage('error', 'cannot get data (4)');
                return false;
            };
        }, this);
    }
    
    /**
    * Store utility method
    */
    dbResources = function (openDb) {
        let db    = openDb.result;
        let tx    = db.transaction("objectStore", "readwrite");
        let store = tx.objectStore("objectStore");

        return {
            "db": db,
            "tx": tx,
            "store": store
        };
    };
    
    /**
    * Store transaction close method
    */
    storageTransactionComplete = function(resources){
        resources.tx.oncomplete = function() {
            resources.db.close();
        };
    };
    
    /**
    * Error message alert
    */
    renderMessage(flag, msg) {
        alert(msg);
    }
}
      
/**
* This class has all methods to capture a move
*/
class MoveLogger {
    /**
    * Class object variables
    */
    constructor(player, space) {
        this.player = player;
        this.space  = space;
    }
    
    /**
    * Update running log of moves with sapce chosen and who moved
    */
    saveMove() {
        let obj = {
            player: this.player,
            space: this.space,
            order: GAMES_OBJ.movesArray.length + 1
        };       
        GAMES_OBJ.movesArray.push(obj);
    }
    
    /**
    * Prepare win data to be saved
    */
    logWin(winningSpaces) {
        GAMES_OBJ.dateTimeStamp  = this.getDateTimeStamp();
        GAMES_OBJ.winLossTieFlag = 1;
        GAMES_OBJ.winner         = this.player;
        (new DatabaseManager()).saveGame(winningSpaces);
    }
    
    /**
    * Add to const game obj 
    */
    logTie() {
        GAMES_OBJ.winLossTieFlag = 2;
        GAMES_OBJ.winner         = '';
    }
    
    /**
    * Create date time stamp
    */
    getDateTimeStamp() {
        let currentdate = new Date();
		
        return pad(currentdate.getMonth() + 1) + "/"
            + pad(currentdate.getDate()) + "/"
            + pad(currentdate.getFullYear()) + " "
            + pad(currentdate.getHours()) + ":"
            + pad(currentdate.getMinutes()) + ":"
            + pad(currentdate.getSeconds());

        function pad(n){
            return n < 10 ? "0" + n : n;
        };
    }
}
      
/**
* This class as all methods for game play
*/
class TicTacToe {
    /*
    * Class object variables
    */
    constructor() {
        this.winningSpaces = [];
        // handler is the game board click event
        this.handler       = function(e) {
            (new TicTacToe()).playerMoves(e.target, true);
        }
    }
    
    /*
    * Determine who should go first, based on last game played.
    */
    startGame(flag) {
        Flags.whoStarted = X;
        let databaseManager = new DatabaseManager()
        databaseManager.idbGetAll().then((data) => { 
            let [startingPlayer, gameBoardType] = databaseManager.showTallies(data);
            this.chooseGameBoardType(gameBoardType, flag);
            if (O === startingPlayer) {
                (new TicTacToe()).startNewGame();
            } else {
                this.initializeGameBoard();
            }
        }, databaseManager);
    }
    
    /**
    * Render correct game board type
    */
    chooseGameBoardType(gameBoardType, flag) {
        let gBoard = X3_GAME_BOARD;
        if (X5 === gameBoardType || X5 === flag) {
            gBoard = X5_GAME_BOARD;
        }
        
        document.querySelector('#gameCont').innerHTML = gBoard;
    }
    
    /*
    * For player X, allow game board to be clickable
    */
    initializeGameBoard() {
        for (const space of document.querySelectorAll(".tttGameBoardTd")) {
            space.addEventListener('click', this.handler);
        }
    }
    
    /*
    * Player initiates a move
    */
    playerMoves(space, userMoved) {
        // Check if space was already played
        if (false === this.isPlayed(space)) {
            this.chooseTurn(space, userMoved);
        }
    }
    
    /*
    * Set variables for the next player, after previous player moves
    */
    chooseTurn(space, userMoved) {
        let player = X;
        if (1 === Flags.turn) {
            space.innerHTML = X;
            Flags.turn = 2;
        } else {
            space.innerHTML = O;
            Flags.turn   = 1;
            player = O;
        }
        // Log previous player's move
        (new MoveLogger(player, space.id)).saveMove(); 
        // Check if previous player won or if game tied   
        this.reviewBoardForWinner(player, userMoved);
    }
    
    /**
    * Check for a tie
    */
    checkForTie() {
        let isTie = false;
        let availableMoves = this.checkForAvailableSpaces();
        if (0 === availableMoves.length) {
            (new MoveLogger("", "")).logTie(); 
            // TIE render here
            isTie = true;
        }
        
        return isTie;
    }
    
    /**
    * Check for a win or a tie
    */
    reviewBoardForWinner(player, userMoved) {
        let isWinner      = false;
        let playerChoices = this.getPlayerChoices(player);
        for (let i = 0; i < Flags.gameProperties.winningMoves.length; i++) {
            if (Flags.gameProperties.numberOfSpacesToWin === this.reviewChoices(playerChoices, i)) {
                isWinner = true;
                this.removeListeners();
                // Save game, if a win
                this.processWin(player);
                return false;
            } else {
                this.winningSpaces = [];
            }
        }
        this.isTieOrNextPlayer(player, userMoved);
    }
    
    /**
    * if not tie, let player go next, else start new game
    */
    isTieOrNextPlayer(player, userMoved) {
        let isTie = this.checkForTie();  
        if (false === isTie) {
            // If not a tie, let other player go
            this.nextPlayer(player, userMoved);
        } else {
            this.removeListeners();
            // Save game, if a tie, and then start a new game
            (new DatabaseManager()).saveGame(this.winningSpaces);
            setTimeout(function () {
                (new TicTacToe()).startNewGame();
            }, 1000);
        }
    }
    
    /**
    * Detemrine if app (player O) goes next
    */
    nextPlayer(player, userMoved) {
        if (true === userMoved) {
            this.appsMove();
        }
    }
    
    /**
    * Prepare player O to move
    */
    appsMove() {
        this.removeListeners();
        (new DatabaseManager())
            .idbGetAll()
            .then((data) => { 
                if (data.length > 0 || GAMES_OBJ.movesArray.length > 0) {
                    // Here is where machine learning begins
                    let chosenSpace = (new AnalyzeData(data)).initializeAnalysis();
                    if (false !== chosenSpace) {
                        this.playerMoves(document.querySelector('#' + chosenSpace), false);
                        this.initializeGameBoard();
                    } else {
                        // If there is no move, then the app will move randomly
                        this.appRandomMove();
                    }
                } else {
                    // If there is no move, then the app will move randomly
                    this.appRandomMove();
                }           
            });
    }
    
    /**
    * Iterate over game board for available spaces
    */
    checkForAvailableSpaces() {
        let availableMoves = [];
        for (const space of document.querySelectorAll(".tttGameBoardTd")) {
            if (false === this.isPlayed(space)) {
                availableMoves.push(space.id);
            }
        }
        
        return availableMoves;
    }
    
    /**
    * This is the only hard-coded instruction for player O
    * Player O must randomly make a move if they have no data to determine a move
    */
    appRandomMove() {
        let availableMoves = this.checkForAvailableSpaces();
        let randomSpace    = availableMoves[
            Math.floor(Math.random() * availableMoves.length)
        ];
        this.playerMoves(document.querySelector('#' + randomSpace), false);
        this.initializeGameBoard();
    }
    
    /**
    * Disallow player X from clicking on game board while player O plays
    */
    removeListeners() {
        for (const space of document.querySelectorAll(".tttGameBoardTd")) {
            let newSpace = space.cloneNode(true);
            space.parentNode.replaceChild(newSpace, space);
        }
    }
    
    /**
    * Log the win, show winning spaces, and then start new game
    */
    processWin(player) {
        (new MoveLogger(player, "")).logWin(this.winningSpaces); 
        this.winningSpaces.map(function (value, index)  {
            document.querySelector("#" + value)
                .style.backgroundColor = "green";
        });
        setTimeout(function () {
            (new TicTacToe()).startNewGame();
        }, 1000);
    }
    
    /**
    * Determine who goes first for new game, after a previous game (i.e. not onload)
    */
    startNewGame() {
        let databaseManager = new DatabaseManager()
        databaseManager.idbGetAll().then((data) => { 
            databaseManager.showTallies(data);
        }, databaseManager);        
        this.updateFlagsForNewGame();
    }
    
    /**
    * Prepare resources for new game
    */
    updateFlagsForNewGame() {
        this.clearBoard();
        // allow other player to go first
        if (X === Flags.whoStarted) {
            Flags.whoStarted = O;
            Flags.turn = 2;
            // need to clear some variables
            GAMES_OBJ.movesArray = [];
            this.appsMove(); // Player O goes
        } else {
            Flags.whoStarted = X;
            Flags.turn = 1;
            this.initializeGameBoard(); // Player X goes
        }
    }
    
    /**
    * Clear the game board
    */
    clearBoard() {
        for (const space of document.querySelectorAll(".tttGameBoardTd")) {
            space.innerHTML             = '&nbsp;';
            space.style.backgroundColor = "white";
        }
    }
    
    /**
    * Check if a player's moves matches a win
    */
    reviewChoices(playerChoices, count) {
        let choiceMatchCount = 0;
        playerChoices.map(function (value, index)  {
            if (Flags.gameProperties.winningMoves[count].includes(value)) {
                this.winningSpaces.push(value);
                choiceMatchCount = choiceMatchCount + 1;
            }
        }, this);
       
        return choiceMatchCount;
    }
    
    /**
    * Get the current moves by a player from the game board
    */
    getPlayerChoices(player) {
        let chosenSpaces = [];
        for (const space of document.querySelectorAll(".tttGameBoardTd")) {
            if (player === space.innerHTML) {
                chosenSpaces.push(space.id);
            }
        }
        
        return chosenSpaces;
    }
    
    /**
    * Confirm if a space is open to play
    */
    isPlayed(space) {
        let arr = [X,O];       
        return arr.includes(space.innerHTML);
    }
}

