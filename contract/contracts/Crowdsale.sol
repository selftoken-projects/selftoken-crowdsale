pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Claimable.sol";

/*
Doc:
https://docs.google.com/document/d/1Fe5MQ0NLFEhHXhliSfrTid194W1rqSQzx1e-kjpeoLQ/edit#
*/
contract Crowdsale is Claimable {
    using SafeMath for uint;

    // -----------------------------------------
    // configs
    // -----------------------------------------

    // How many token units a buyer gets per wei.
    // If ERC20 decimals = 18, then a token unit is (10 ** (-18)) token
    uint256 public rate = 3600;

    // TODO: delete openingTime?
    uint256 public openingTime; // 2018/9/3 12:00 (UTC+8)
    uint256 public closingTime; // 2018/10/31 24:00 (UTC+8)

    /// @notice The min total amount of tokens a user have to buy.
    /// Not the minimum amount of tokens purchased in each transaction.
    /// A user can buy 200 tokens and then buy 100 tokens.
    uint public minTokensPurchased = 200 ether; // 200 tokens
    uint public hardCap = 10000 ether; // hard cap

    // TODO: change to better name
    uint public referralBonusPercentage = 5; // 5%. both referrer's bonus
    uint public referredBonusPercentage = 5; // 5%. referred purchaser's bonus

    // airdrop 45000 tokens to pioneers whenever 1000 ETH is raised.
    // until 10000 ETH is reached (or 10 stages)
    uint public pioneerBonusPerStage = 45000 ether; // 45000 tokens
    uint public weiRaisedPerStage = 1000 ether; // 1000 ETH
    uint public maxStages = 10;

    /// @notice After this moment, users are not becoming pioneers anymore.
    uint public pioneerTimeEnd; // 2018/9/17 24:00 (UTC+8)

    uint public pioneerWeiThreshold = 1 ether;

    // -----------------------------------------
    // states
    // -----------------------------------------

    /// total received wei
    uint256 public totalWeiRaised;

    /// weiRaisedFrom[_userAddress]
    mapping(address => uint) public weiRaisedFrom;

    /// @dev isPioneer[_userAddress]
    mapping(address => bool) public isPioneer;

    /// @dev pioneerWeightOfUserInStage[_userAddress][_stageIdx]
    mapping(address => mapping(uint => uint)) public pioneerWeightOfUserInStage;

    /// @notice total increased pioneer weight in stage
    /// @dev totalPioneerWeightInStage[_stageIdx]
    mapping(uint => uint) public totalPioneerWeightInStage;

    // including purchased tokens and referred bonus
    mapping(address => uint) public tokensPurchased;

    mapping(address => uint) public tokensReferralBonus;

    mapping(address => uint) public tokensReferredBonus;

    // -----------------------------------------
    // events
    // -----------------------------------------

    /**
    * Event for token purchase logging
    * @param purchaser who paid for the tokens
    * @param referrer who referred the purchaser. address(0) if not valid referrer
    * @param weis weis paid for purchase
    * @param tokens amount of tokens purchased, not including any bonus
    */
    event TokensPurchased (
        address indexed purchaser,
        address indexed referrer,
        uint256 weis,
        uint256 tokens
    );

    event RateChanged (uint256 rate);
    event HardCapChanged (uint256 cap);
    event ReferralBonusPercentageChanged (uint256 percentage);
    event ReferredBonusPercentageChanged (uint256 percentage);

    modifier onlyWhileOpen {
        require(block.timestamp >= openingTime && block.timestamp <= closingTime, "Crowdsale is finished.");
        _;
    }

    constructor (uint _openingTime, uint _closingTime, uint _pioneerTimeEnd) public {
        openingTime = _openingTime;
        closingTime = _closingTime;
        pioneerTimeEnd = _pioneerTimeEnd;
    }

    // -----------------------------------------
    // Crowdsale external interface
    // -----------------------------------------

    // TODO: check if there's any possibility that address(0) can be a pioneer.
    function () external payable onlyWhileOpen {
        purchaseTokens(address(0));
    }

    function purchaseTokens (address _referredBy) public payable onlyWhileOpen {
        // Check if hard cap has been reached.
        require(totalWeiRaised < hardCap, "Hard cap has been reached.");

        uint _weiPaid = msg.value;

        // If hard cap is reached in this tx, pay as much ETH as possible
        if (totalWeiRaised.add(_weiPaid) > hardCap) {
            _weiPaid = hardCap.sub(totalWeiRaised);
        }

        uint _tokensPurchased = _weiPaid.mul(rate);

        // Check if buying enough tokens
        require(tokensPurchased[msg.sender].add(_tokensPurchased) >= minTokensPurchased, "Purchasing not enough amount of tokens.");

        bool isValidReferrer = (_referredBy != address(0))
            && isPioneer[_referredBy]
            && (_referredBy != msg.sender);

        // update token balances
        if (isValidReferrer) {
            uint _referredTokens = _tokensPurchased.mul(referredBonusPercentage).div(100);
            uint _referralTokens = _tokensPurchased.mul(referralBonusPercentage).div(100);

            tokensPurchased[msg.sender] = tokensPurchased[msg.sender].add(_tokensPurchased);
            tokensReferredBonus[msg.sender] = tokensReferredBonus[msg.sender].add(_referredTokens);
            tokensReferralBonus[_referredBy] = tokensReferralBonus[_referredBy].add(_referralTokens);
        } else {
            tokensPurchased[msg.sender] = tokensPurchased[msg.sender].add(_tokensPurchased);
            _referredBy = address(0); // means that the referrer is not valid
        }

        emit TokensPurchased(
            msg.sender,
            _referredBy,
            _weiPaid,
            _tokensPurchased
        );

        // update wei raised
        weiRaisedFrom[msg.sender] = weiRaisedFrom[msg.sender].add(_weiPaid);
        totalWeiRaised = totalWeiRaised.add(_weiPaid);

        // update pioneer bonus weight
        uint _stageIdx = currentStage();
        uint _increasedPioneerWeight = 0;
        // if the sender has been a pioneer
        if (isPioneer[msg.sender]) {
            _increasedPioneerWeight = _weiPaid;
        }
        // if the sender was not a pioneer
        else {
            // During the time that users can become pioneers.
            if (block.timestamp <= pioneerTimeEnd
            // sender has paid >= pioneerWeiThreshold
            && weiRaisedFrom[msg.sender] >= pioneerWeiThreshold) {
                // the sender becomes a pioneer
                isPioneer[msg.sender] = true;
                _increasedPioneerWeight = weiRaisedFrom[msg.sender];
            }
        }

        if (_increasedPioneerWeight != 0) {
            // add _increasedPioneerWeight to pioneerWeightOfUserInStage
            pioneerWeightOfUserInStage[msg.sender][_stageIdx] = pioneerWeightOfUserInStage[msg.sender][_stageIdx].add(_increasedPioneerWeight);
            // add _increasedPioneerWeight to totalPioneerWeightInStage
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
    function currentStage() public view returns (uint _stageIdx) {
        _stageIdx = totalWeiRaised.div(weiRaisedPerStage);
        return (_stageIdx >= maxStages) ? maxStages : _stageIdx;
    }

    /// @return amount of pioneer bonus tokens
    function calcPioneerBonus(address _user) public view returns (uint _tokens) {
        uint _userWeight = 0;
        uint _totalWeight = 0;
        uint _currentStage = currentStage();
        for (uint _stageIdx = 0; _stageIdx < _currentStage; _stageIdx++) {
            _userWeight = _userWeight.add(pioneerWeightOfUserInStage[_user][_stageIdx]);
            _totalWeight = _totalWeight.add(totalPioneerWeightInStage[_stageIdx]);

            _tokens = _tokens.add(
                pioneerBonusPerStage.mul(_userWeight).div(_totalWeight)
            );
        }
        return _tokens;
    }

    /// @return token balance of a user
    function balanceOf(address _user) public view returns (uint _balance) {
        return (
            tokensPurchased[_user]
            + tokensReferralBonus[_user]
            + tokensReferredBonus[_user]
            + calcPioneerBonus(_user)
        );
    }

    // -----------------------------------------
    // setters
    // -----------------------------------------

    function setRate (uint _rate) public onlyOwner {
        rate = _rate;
        emit RateChanged(_rate);
    }

    function setMinTokensPurchased (uint _amount) public onlyOwner {
        minTokensPurchased = _amount;
    }

    function setHardCap (uint _hardCap) public onlyOwner {
        hardCap = _hardCap;
        emit HardCapChanged(_hardCap);
    }

    function setReferralBonusPercentage (uint _percentage) public onlyOwner {
        referralBonusPercentage = _percentage;
        emit ReferralBonusPercentageChanged(_percentage);
    }

    function setReferredBonusPercentage (uint _percentage) public onlyOwner {
        referredBonusPercentage = _percentage;
        emit ReferredBonusPercentageChanged(_percentage);
    }

    function setOpeningTime (uint _time) public onlyOwner {
        openingTime = _time;
    }

    function setClosingTime (uint _time) public onlyOwner {
        closingTime = _time;
    }

    // -----------------------------------------
    // other owner operation
    // -----------------------------------------

    function withdraw (uint amount) public onlyOwner {
        // TODO: change to fixed address?
        msg.sender.transfer(amount);
    }

    function withdrawAll () public onlyOwner {
        // TODO: change to fixed address?
        msg.sender.transfer(address(this).balance);
    }
}
