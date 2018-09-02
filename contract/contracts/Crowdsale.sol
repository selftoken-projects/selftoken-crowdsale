pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Claimable.sol";

/*
Doc:
https://docs.google.com/document/d/1Fe5MQ0NLFEhHXhliSfrTid194W1rqSQzx1e-kjpeoLQ/edit#
*/
contract Crowdsale is Claimable {
    using SafeMath for uint256;

    // -----------------------------------------
    // configs
    // -----------------------------------------

    // How many token units a buyer gets per wei.
    // If ERC20 decimals = 18, then a token unit is (10 ** (-18)) token
    uint256 public rate = 3600;

    uint256 public openingTime; // 2018/9/3 12:00 (UTC+8)
    uint256 public closingTime; // 2018/10/31 24:00 (UTC+8)

    /// @notice The min total amount of tokens a user have to buy.
    /// Not the minimum amount of tokens purchased in each transaction.
    /// A user can buy 200 tokens and then buy 100 tokens.
    uint256 public minTokensPurchased = 200 ether; // 200 tokens
    uint256 public hardCap = 10000 ether; // hard cap

    uint256 public referSenderBonusPercentage = 5; // 5%. inviter's bonus
    uint256 public referReceiverBonusPercentage = 5; // 5%. purchaser's bonus

    // airdrop 45000 tokens to pioneers whenever 1000 ETH is raised.
    // until 10000 ETH is reached (or 10 stages)
    uint256 public pioneerBonusPerStage = 45000 ether; // 45000 tokens
    uint256 public weiRaisedPerStage = 1000 ether; // 1000 ETH
    uint256 public maxStages = 10;

    /// @notice After this moment, users are not becoming pioneers anymore.
    uint256 public pioneerTimeEnd; // 2018/9/17 24:00 (UTC+8)

    uint256 public pioneerWeiThreshold = 1 ether;

    // -----------------------------------------
    // states
    // -----------------------------------------

    /// total received wei
    uint256 public totalWeiRaised;

    /// weiRaisedFrom[_userAddress]
    mapping(address => uint256) public weiRaisedFrom;

    /// @dev isPioneer[_userAddress]
    mapping(address => bool) public isPioneer;

    /// @notice The pioneer weight a user earns in a specific stage.
    /// Not the sum of all pioneer weight the user has earned.
    /// @dev pioneerWeightOfUserInStage[_userAddress][_stageIdx]
    mapping(address => mapping(uint256 => uint256)) public pioneerWeightOfUserInStage;

    /// @notice The total increased pioneer weight in a specific stage.
    /// Not the sum of pioneer weight users have earned.
    /// @dev totalPioneerWeightInStage[_stageIdx]
    mapping(uint256 => uint256) public totalPioneerWeightInStage;

    // not including any bonus
    mapping(address => uint256) public tokensPurchased;

    mapping(address => uint256) public tokensReferSenderBonus;

    mapping(address => uint256) public tokensReferReceiverBonus;

    // -----------------------------------------
    // events
    // -----------------------------------------

    /**
    * Event for token purchase logging
    * @param purchaser who paid for the tokens
    * @param referSender who invited the purchaser. address(0) if not valid referSender
    * @param weis weis paid for purchase
    * @param tokens amount of tokens purchased, not including any bonus
    */
    event TokensPurchased (
        address indexed purchaser,
        address indexed referSender,
        uint256 weis,
        uint256 tokens
    );

    event RateChanged (uint256 rate);
    event HardCapChanged (uint256 cap);
    event ReferSenderBonusPercentageChanged (uint256 percentage);
    event ReferReceiverBonusPercentageChanged (uint256 percentage);

    modifier onlyWhileOpen {
        require(block.timestamp >= openingTime && block.timestamp <= closingTime, "Crowdsale is not opened.");
        _;
    }

    constructor (uint256 _openingTime, uint256 _closingTime, uint256 _pioneerTimeEnd) public {
        openingTime = _openingTime;
        closingTime = _closingTime;
        pioneerTimeEnd = _pioneerTimeEnd;
    }

    // -----------------------------------------
    // Crowdsale external interface
    // -----------------------------------------

    function () external payable onlyWhileOpen {
        purchaseTokens(address(0));
    }

    function purchaseTokens (address _referSender) public payable onlyWhileOpen {
        // Check if hard cap has been reached.
        require(totalWeiRaised < hardCap, "Hard cap has been reached.");

        uint256 _weiPaid = msg.value;

        // If hard cap is reached in this tx, pay as much ETH as possible
        if (totalWeiRaised.add(_weiPaid) > hardCap) {
            _weiPaid = hardCap.sub(totalWeiRaised);
        }

        uint256 _tokensPurchased = _weiPaid.mul(rate);

        // Check if buying enough tokens
        require(tokensPurchased[msg.sender].add(_tokensPurchased) >= minTokensPurchased, "Purchasing not enough amount of tokens.");

        bool isValidReferSender = (_referSender != address(0))
            && isPioneer[_referSender]
            && (_referSender != msg.sender);

        // update token balances
        if (isValidReferSender) {
            uint256 _referSenderTokens = _tokensPurchased.mul(referSenderBonusPercentage).div(100);
            uint256 _referReceiverTokens = _tokensPurchased.mul(referReceiverBonusPercentage).div(100);

            tokensReferSenderBonus[_referSender] = tokensReferSenderBonus[_referSender].add(_referSenderTokens);
            tokensReferReceiverBonus[msg.sender] = tokensReferReceiverBonus[msg.sender].add(_referReceiverTokens);
        }
        tokensPurchased[msg.sender] = tokensPurchased[msg.sender].add(_tokensPurchased);

        emit TokensPurchased(
            msg.sender,
            (isValidReferSender) ? _referSender : address(0),
            _weiPaid,
            _tokensPurchased
        );

        // must get currentStage before totalWeiRaised is updated.
        uint256 _stageIdx = currentStage();

        // update wei raised
        weiRaisedFrom[msg.sender] = weiRaisedFrom[msg.sender].add(_weiPaid);
        totalWeiRaised = totalWeiRaised.add(_weiPaid);

        // update pioneer bonus weight
        uint256 _increasedPioneerWeight = 0;
        // if the sender has been a pioneer
        if (isPioneer[msg.sender]) {
            _increasedPioneerWeight = _weiPaid;
        }
        // if the sender was not a pioneer
        else {
            // During the time that users can become pioneers.
            // And (total amount of ETH the sender has paid) >= pioneerWeiThreshold
            if (block.timestamp <= pioneerTimeEnd && weiRaisedFrom[msg.sender] >= pioneerWeiThreshold) {
                // the sender becomes a pioneer
                isPioneer[msg.sender] = true;
                _increasedPioneerWeight = weiRaisedFrom[msg.sender];
            }
        }

        // update pioneer weight if necessary
        if (_increasedPioneerWeight > 0) {
            pioneerWeightOfUserInStage[msg.sender][_stageIdx] = pioneerWeightOfUserInStage[msg.sender][_stageIdx].add(_increasedPioneerWeight);
            totalPioneerWeightInStage[_stageIdx] = totalPioneerWeightInStage[_stageIdx].add(_increasedPioneerWeight);
        }

        // pay back unused ETH
        if (msg.value > _weiPaid) {
            msg.sender.transfer(msg.value.sub(_weiPaid));
        }
    }

    // -----------------------------------------
    // getters
    // -----------------------------------------

    // equals to completed stage
    function currentStage() public view returns (uint256 _stageIdx) {
        _stageIdx = totalWeiRaised.div(weiRaisedPerStage);
        return (_stageIdx >= maxStages) ? maxStages : _stageIdx;
    }

    /// @return amount of pioneer bonus tokens
    function calcPioneerBonus(address _user) public view returns (uint256 _tokens) {
        uint256 _userWeight = 0;
        uint256 _totalWeight = 0;
        uint256 _currentStage = currentStage();
        for (uint256 _stageIdx = 0; _stageIdx < _currentStage; _stageIdx++) {
            _userWeight = _userWeight.add(pioneerWeightOfUserInStage[_user][_stageIdx]);
            _totalWeight = _totalWeight.add(totalPioneerWeightInStage[_stageIdx]);

            if (_totalWeight > 0) {
                _tokens = _tokens.add(
                    pioneerBonusPerStage.mul(_userWeight).div(_totalWeight)
                );
            }
        }
        return _tokens;
    }

    /// @return token balance of a user
    function balanceOf(address _user) public view returns (uint256 _balance) {
        return (
            tokensPurchased[_user]
            + tokensReferSenderBonus[_user]
            + tokensReferReceiverBonus[_user]
            + calcPioneerBonus(_user)
        );
    }

    // -----------------------------------------
    // setters
    // -----------------------------------------

    function setRate (uint256 _rate) public onlyOwner {
        rate = _rate;
        emit RateChanged(_rate);
    }

    function setOpeningTime (uint256 _time) public onlyOwner {
        openingTime = _time;
    }

    function setClosingTime (uint256 _time) public onlyOwner {
        closingTime = _time;
    }

    function setMinTokensPurchased (uint256 _tokenAmount) public onlyOwner {
        minTokensPurchased = _tokenAmount;
    }

    function setHardCap (uint256 _hardCap) public onlyOwner {
        hardCap = _hardCap;
        emit HardCapChanged(_hardCap);
    }

    function setReferSenderBonusPercentage (uint256 _percentage) public onlyOwner {
        referSenderBonusPercentage = _percentage;
        emit ReferSenderBonusPercentageChanged(_percentage);
    }

    function setReferReceiverBonusPercentage (uint256 _percentage) public onlyOwner {
        referReceiverBonusPercentage = _percentage;
        emit ReferReceiverBonusPercentageChanged(_percentage);
    }

    function setPioneerBonusPerStage (uint256 _tokenAmount) public onlyOwner {
        pioneerBonusPerStage = _tokenAmount;
    }

    function setMaxStages (uint256 _maxStages) public onlyOwner {
        uint _currentStage = currentStage();
        require(_currentStage < maxStages);
        require(_currentStage < _maxStages);
        maxStages = _maxStages;
    }

    function setPioneerTimeEnd (uint256 _time) public onlyOwner {
        require(block.timestamp < pioneerTimeEnd);
        require(block.timestamp < _time);
        pioneerTimeEnd = _time;
    }

    // -----------------------------------------
    // other owner operation
    // -----------------------------------------

    function withdraw (uint256 amount) public onlyOwner {
        // TODO: change to fixed address?
        msg.sender.transfer(amount);
    }

    function withdrawAll () public onlyOwner {
        // TODO: change to fixed address?
        msg.sender.transfer(address(this).balance);
    }
}
