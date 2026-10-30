// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface ISqueekCore {
    struct CoreState {
        uint64 settledThroughRound;
        uint64 cumulativeWork;
        uint96 cumulativeBlockUnits;
        uint64 blockHeight;
        uint96 blockProgress;
        uint32 workPerThousandBlocks;
        uint256 authorizationNonce;
        bool paused;
    }
    function state() external view returns (CoreState memory);
}

/// @notice Free ERC-721. Real-time RPM is reported from the public API by a designated reporter.
///         Settled progress is read directly from SqueekCore. No admin can mint, pause or seize NFTs.
contract SqueekCompanion is ERC721, Ownable2Step {
    using Strings for uint256;

    address public constant SQUEEK_CORE = 0x74665dAecA35A2303e767E76a2FF1FB6F93e119f;
    uint256 public constant STATUS_TTL = 120;
    uint256 public constant FAST_RPM_MILLI = 60_000;
    uint256 public totalSupply;
    mapping(address => bool) public hasMinted;
    address public reporter;

    struct Snapshot {
        uint32 rpmMilli;
        bool spinning;
        uint64 observedAt;
        bytes32 revisionHash;
    }
    Snapshot public snapshot;

    struct Traits {
        uint32 rpmMilli;
        bool spinning;
        uint64 observedAt;
        bool fresh;
        uint64 blockHeight;
        uint96 blockProgress;
        bool coreAvailable;
    }

    error WrongChain();
    error AlreadyMinted();
    error NotReporter();
    error InvalidReporter();
    error InvalidObservation();
    event ReporterChanged(address indexed reporter);
    event StatusPublished(uint32 rpmMilli, bool spinning, uint64 observedAt, bytes32 revisionHash);
    // ERC-4906 marketplace metadata refresh signals.
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    constructor(address initialOwner) ERC721("Squeek Companion", "SQUEEK") Ownable(initialOwner) {
        if (block.chainid != 11155111) revert WrongChain();
        reporter = initialOwner;
        emit ReporterChanged(initialOwner);
    }

    function mint() external {
        if (hasMinted[msg.sender]) revert AlreadyMinted();
        hasMinted[msg.sender] = true;
        uint256 id = ++totalSupply;
        _safeMint(msg.sender, id);
    }

    function setReporter(address nextReporter) external onlyOwner {
        if (nextReporter == address(0)) revert InvalidReporter();
        reporter = nextReporter;
        emit ReporterChanged(nextReporter);
    }

    /// @dev A trusted reporter publishes real measurements; this contract does not verify the API's signature.
    ///      revisionHash is keccak256(UTF-8 API revision), an audit pointer, not cryptographic proof of origin.
    function publishStatus(uint32 rpmMilli, bool spinning, uint64 observedAt, bytes32 revisionHash) external {
        if (msg.sender != reporter) revert NotReporter();
        if (
            observedAt <= snapshot.observedAt || observedAt > block.timestamp
                || block.timestamp - observedAt > STATUS_TTL || revisionHash == bytes32(0)
        ) revert InvalidObservation();
        snapshot = Snapshot(rpmMilli, spinning, observedAt, revisionHash);
        emit StatusPublished(rpmMilli, spinning, observedAt, revisionHash);
        if (totalSupply > 0) emit BatchMetadataUpdate(1, totalSupply);
    }

    function currentTraits() public view returns (Traits memory t) {
        Snapshot memory s = snapshot;
        t.rpmMilli = s.rpmMilli;
        t.spinning = s.spinning;
        t.observedAt = s.observedAt;
        t.fresh = s.observedAt != 0 && block.timestamp <= uint256(s.observedAt) + STATUS_TTL;
        try ISqueekCore(SQUEEK_CORE).state{gas: 50_000}() returns (ISqueekCore.CoreState memory core) {
            // Guard the pinned ABI's ledger identities before accepting an upstream upgrade's output.
            if (
                core.blockProgress < 1_000_000_000
                    && uint256(core.cumulativeBlockUnits) == uint256(core.blockHeight) * 1_000_000_000 + core.blockProgress
            ) {
                t.blockHeight = core.blockHeight;
                t.blockProgress = core.blockProgress;
                t.coreAvailable = true;
            }
        } catch { /* A broken upstream must not break metadata, minting or transfers. */ }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Traits memory t = currentTraits();
        string memory mood = !t.fresh ? "Signal unavailable"
            : !t.spinning ? "Resting" : t.rpmMilli >= FAST_RPM_MILLI ? "Energetic" : "Active";
        string memory attributes = string.concat(
            '[{"trait_type":"Mood","value":"', mood,
            '"},{"trait_type":"Wheel RPM (milli)","value":', uint256(t.rpmMilli).toString(),
            '},{"trait_type":"Wheel state","value":"', !t.fresh ? "Unknown" : t.spinning ? "Spinning" : "Idle",
            '"},{"trait_type":"Measured at","display_type":"date","value":', uint256(t.observedAt).toString(),
            '},{"trait_type":"Settled Squeek block","value":', uint256(t.blockHeight).toString(),
            '},{"trait_type":"Block progress (billionths)","value":', uint256(t.blockProgress).toString(),
            '},{"trait_type":"Core data","value":"', t.coreAvailable ? "Available" : "Unavailable", '"}]'
        );
        string memory json = string.concat(
            '{"name":"Squeek Companion #', tokenId.toString(),
            '","description":"A living companion following Squeekchain. RPM comes from a trusted API reporter; '
            'settled progress comes directly from SqueekCore. An expired observation is unknown, never idle.",'
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(_image(tokenId, t, mood))),
            '","attributes":', attributes, '}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _image(uint256 tokenId, Traits memory t, string memory mood) internal pure returns (string memory) {
        bool resting = t.fresh && !t.spinning;
        bool energetic = t.fresh && t.spinning && t.rpmMilli >= FAST_RPM_MILLI;
        string memory bg = !t.fresh ? "#eeeae4" : resting ? "#e8e3f4" : energetic ? "#f9d895" : "#dfead9";
        string memory eyes = resting
            ? '<path d="M172 224q10 10 20 0m36 0q10 10 20 0" stroke="#4c3830" stroke-width="5" fill="none" stroke-linecap="round"/>'
            : '<g fill="#4c3830"><circle cx="183" cy="225" r="6"/><circle cx="237" cy="225" r="6"/></g>';
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420">',
            '<rect width="420" height="420" fill="', bg, '"/>',
            energetic ? '<path d="m70 95-20 35h25l-15 30m275-70-20 35h25l-15 30" fill="none" stroke="#a76c24" stroke-width="7"/>' : '',
            '<ellipse cx="210" cy="325" rx="100" ry="15" fill="#4c3830" opacity=".1"/>',
            '<circle cx="148" cy="153" r="34" fill="#d79a62"/><circle cx="272" cy="153" r="34" fill="#d79a62"/>',
            '<circle cx="148" cy="153" r="20" fill="#e6b1a0"/><circle cx="272" cy="153" r="20" fill="#e6b1a0"/>',
            '<ellipse cx="210" cy="246" rx="94" ry="90" fill="#d99d64"/>',
            '<ellipse cx="210" cy="263" rx="69" ry="65" fill="#ffe3b9"/>', eyes,
            '<ellipse cx="210" cy="249" rx="9" ry="6" fill="#c57b79"/>',
            '<path d="M210 255v9m-10 0q10 10 20 0" stroke="#4c3830" stroke-width="3" fill="none" stroke-linecap="round"/>',
            '<ellipse cx="158" cy="320" rx="25" ry="11" fill="#b57e55"/><ellipse cx="262" cy="320" rx="25" ry="11" fill="#b57e55"/>',
            '<rect x="40" y="360" width="340" height="5" rx="2" fill="#fff"/>',
            '<rect x="40" y="360" width="', (uint256(t.blockProgress) * 340 / 1_000_000_000).toString(), '" height="5" rx="2" fill="#7461c7"/>',
            '<g fill="#4c3830" font-family="sans-serif" text-anchor="middle"><text x="210" y="43" font-size="18">Squeek Companion #',
            tokenId.toString(), '</text><text x="210" y="398" font-size="16">', mood, '</text></g></svg>'
        );
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == 0x49064906 || super.supportsInterface(interfaceId);
    }
}
