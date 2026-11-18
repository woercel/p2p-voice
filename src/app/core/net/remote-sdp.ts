import { dropExtmapCollisions } from './extmap';
import { tuneOpus } from './opus-sdp';

let installed = false;

function patch(pc: RTCPeerConnection, description: RTCSessionDescriptionInit, bitrate: number) {
  let sdp = tuneOpus(description.sdp ?? '', bitrate);
  if (description.type === 'offer') {
    const known = [pc.localDescription, pc.currentLocalDescription, pc.currentRemoteDescription]
      .map((d) => d?.sdp ?? '')
      .filter(Boolean);
    sdp = dropExtmapCollisions(sdp, known);
  }
  return { type: description.type, sdp };
}

/**
 * fmtp parameters describe what the author of an SDP wants to receive, so rewriting the
 * remote description makes our own Opus encoder send stereo at the requested bitrate.
 */
export function installRemoteSdpPatches(bitrate: () => number): void {
  if (installed || typeof RTCPeerConnection === 'undefined') return;
  installed = true;

  const original = RTCPeerConnection.prototype.setRemoteDescription as (
    this: RTCPeerConnection,
    description: RTCSessionDescriptionInit,
  ) => Promise<void>;
  RTCPeerConnection.prototype.setRemoteDescription = function (
    this: RTCPeerConnection,
    description: RTCSessionDescriptionInit,
  ) {
    return original.call(
      this,
      description?.sdp ? patch(this, description, bitrate()) : description,
    );
  };
}
