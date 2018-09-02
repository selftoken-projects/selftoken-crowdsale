pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/*
Doc:
https://docs.google.com/document/d/1Fe5MQ0NLFEhHXhliSfrTid194W1rqSQzx1e-kjpeoLQ/edit#

Prerequisites:
1. An ERC20 contract is deployed
2. An account A is granted at least the salable tokens
3. The Crowdsale contract is deployed at address C
4. The account A approve()s C of the salable amount
*/
contract Crowdsale is Ownable {
    using SafeMath for uint;

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
    uint public minTokensPurchased = 200 ether; // 200 tokens
    uint public hardCap = 10000 ether; // hard cap

    uint public referralBonusPercentage = 5; // 5%. both referrer's bonus
    uint public referredBonusPercentage = 5; // 5%. referred purchaser's bonus

    // airdrop 45000 tokens to pioneers whenever 1000 ETH is raised.
    // until 10000 ETH is reached (or 10 stages)
    uint public pioneerBonusPerStage = 45000 ether; // 45000 tokens
    uint public weiRaisedPerStage = 1000 ether; // 1000 ETH
    uint public totalStages = 10;

    /// @notice After this moment, users are not becoming pioneers anymore.
    uint public pioneerTimeEnd; // 2018/9/17 24:00 (UTC+8)

    uint public pioneerWeiThreshold = 1 ether;

    // -----------------------------------------
    // states
    // -----------------------------------------

    /// total received wei
    uint256 public weiRaised;

    /// weiRaisedFrom[_userAddress]
    mapping(address => uint) public weiRaisedFrom;

    /// @dev isPioneer[_userAddress]
    mapping(address => bool) public isPioneer;

    /// @dev increasedPioneerWeightOfUserInStage[_userAddress][_stageIdx]
    mapping(address => mapping(uint => uint)) public increasedPioneerWeightOfUserInStage;

    /// @notice total increased pioneer weight in stage
    /// @dev increasedPioneerWeightInStage[_stageIdx]
    mapping(uint => uint) public increasedPioneerWeightInStage;

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
        require(block.timestamp >= openingTime && block.timestamp <= closingTime);
        _;
    }

    constructor (uint _openingTime, uint _closingTime) public {
        openingTime = _openingTime;
        closingTime = _closingTime;
    }

    // -----------------------------------------
    // Crowdsale external interface
    // -----------------------------------------

    function () external payable onlyWhileOpen {
        purchaseTokens(address(0));
    }

    function purchaseTokens (address _referrer) public payable onlyWhileOpen {
        // Check if hard cap has been reached.
        require(weiRaised < hardCap, "Hard cap has been reached.");

        uint _weiPaid = msg.value;

        // If hard cap is reached in this tx, pay as much ETH as possible
        if (weiRaised.add(_weiPaid) > hardCap) {
            _weiPaid = hardCap.sub(weiRaised);
        }

        uint _tokensPurchased = _weiPaid.mul(rate);

        // Check if buying enough tokens
        require(_tokensPurchased >= minTokensPurchased, "Purchasing not enough amount of tokens.");

        bool isValidReferrer = (_referrer != address(0))
            && (tokensPurchased[_referrer] > 0)
            && (_referrer != msg.sender);

        // update token balances
        if (isValidReferrer) {
            uint _referralTokens = _tokensPurchased.mul(referralBonusPercentage).div(100);
            uint _referredTokens = _tokensPurchased.mul(referredBonusPercentage).div(100);

            tokensPurchased[msg.sender] = tokensPurchased[msg.sender].add(_tokensPurchased);
            tokensReferredBonus[msg.sender] = tokensReferredBonus[msg.sender].add(_referredTokens);
            tokensReferralBonus[_referrer] = tokensReferralBonus[_referrer].add(_referralTokens);

        } else {
            tokensPurchased[msg.sender] = tokensPurchased[msg.sender].add(_tokensPurchased);
            _referrer = address(0); // means that the referrer is not valid
        }

        emit TokensPurchased(
            msg.sender,
            _referrer,
            _weiPaid,
            _tokensPurchased
        );

        // update wei raised
        weiRaisedFrom[msg.sender] = weiRaisedFrom[msg.sender].add(_weiPaid);
        weiRaised = weiRaised.add(_weiPaid);

        // update pioneer bonus weight
        uint _stageIdx = currentStage();
        // if the sender has been a pioneer
        if (isPioneer[msg.sender]) {
            // uint _increasedPioneerWeight == _weiPaid;

            // add _increasedPioneerWeight to increasedPioneerWeightOfUserInStage
            increasedPioneerWeightOfUserInStage[msg.sender][_stageIdx] = increasedPioneerWeightOfUserInStage[msg.sender][_stageIdx].add(_weiPaid);

            // add _increasedPioneerWeight to increasedPioneerWeightInStage
            increasedPioneerWeightInStage[_stageIdx] = increasedPioneerWeightInStage[_stageIdx].add(_weiPaid);
        }
        // if the sender was not a pioneer
        else {
            // During the time that users can become pioneers.
            if (block.timestamp <= pioneerTimeEnd
            // sender has paid >= pioneerWeiThreshold
            && weiRaisedFrom[msg.sender] >= pioneerWeiThreshold) {
                // the sender becomes a pioneer
                isPioneer[msg.sender] = true;

                // uint _increasedPioneerWeight = weiRaisedFrom[msg.sender];

                // add _increasedPioneerWeight to increasedPioneerWeightOfUserInStage
                increasedPioneerWeightOfUserInStage[msg.sender][_stageIdx] = increasedPioneerWeightOfUserInStage[msg.sender][_stageIdx].add(weiRaisedFrom[msg.sender]);

                // add _increasedPioneerWeight to increasedPioneerWeightInStage
                increasedPioneerWeightInStage[_stageIdx] = increasedPioneerWeightInStage[_stageIdx].add(weiRaisedFrom[msg.sender]);
            }
        }

        // pay back unused ETH
        if (msg.value != _weiPaid) {
            msg.sender.transfer(msg.value.sub(_weiPaid));
        }
    }

    // -----------------------------------------
    // getters
    // -----------------------------------------

    // equals to completed stage
    function currentStage() public view returns (uint _stageIdx) {
        _stageIdx = weiRaised.div(weiRaisedPerStage);
        return (_stageIdx >= totalStages) ? totalStages : _stageIdx;
    }

    /// @return amount of pioneer bonus tokens
    function calcPioneerBonus(address _user) public view returns (uint _tokens) {
        uint _userWeight = 0;
        uint _totalWeight = 0;
        uint _currentStage = currentStage();
        for (uint _stageIdx = 0; _stageIdx < _currentStage; _stageIdx++) {
            _userWeight = _userWeight.add(increasedPioneerWeightOfUserInStage[_user][_stageIdx]);
            _totalWeight = _totalWeight.add(increasedPioneerWeightInStage[_stageIdx]);

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
        msg.sender.transfer(amount);
    }

    function withdrawAll () public onlyOwner {
        msg.sender.transfer(address(this).balance);
    }
}
