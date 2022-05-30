import {initializeApp} from 'firebase/app';
import $ from "jquery";
import {getFirestore,collection,doc, addDoc,setDoc, getDoc, updateDoc, onSnapshot, deleteDoc, query} from 'firebase/firestore'
// htmlPage = `
// `

// document.querySelector("#app").innerHTML = htmlPage

const firebaseConfig = {
  apiKey: "AIzaSyDeImsqpytP_y9duxoVUpDsJsnmxBDLi70",
  authDomain: "web-rtc-test-9baf4.firebaseapp.com",
  projectId: "web-rtc-test-9baf4",
  storageBucket: "web-rtc-test-9baf4.appspot.com",
  messagingSenderId: "947995416625",
  appId: "1:947995416625:web:724a72f5bbb1ce0da3dd10",
  measurementId: "G-K8BK5LY9C6"
};

// Initialize Firebase

const app = initializeApp(firebaseConfig);
const db = getFirestore(app)

const servers = {
    iceServers: [
        {
            urls:['stun:stun3.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302'],
        },

    ],
    iceCandidatePoolSize: 10,
}


let pc = new RTCPeerConnection(servers);

let localStream = null;
let remoteStream = null;

//Add more buttons

const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('thisVideo');

const remoteVideo = document.getElementById('remoteVideo');
const callInput = document.getElementById('callCode');
const endButton = document.getElementById('endCall');

const calls = collection(db,"calls")  
const sp = new URLSearchParams(document.location.search);

let StartWebcam = async() =>{
    localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    remoteStream = new MediaStream();

    //Variable to connectiion


    localStream.getTracks().forEach(track =>{
        pc.addTrack(track,localStream);
    })

    //Connection to Variable
    pc.ontrack = event => event.streams[0].getTracks().forEach(track =>{remoteStream.addTrack(track)})

    webcamVideo.srcObject = localStream
    webcamVideo.muted = true;
    remoteVideo.srcObject = remoteStream

}


let CreateOffer = async() =>{
    //Calls -> randomIDofCall ->offer and answers

    const calldoc = doc(calls)
    callInput.value = calldoc.id;

    const offer = await pc.createOffer();
    pc.setLocalDescription(offer);
    
    

    pc.onicecandidate = event =>
    {
       event.candidate && addDoc(collection(calldoc,"offerCandidates"),event.candidate.toJSON()).then(console.log("Done"))
    }
    const offerObject = {
        sdp: offer.sdp,
        type: offer.type
    }

    await setDoc(calldoc,{offerObject})
    
    console.log("Starting call")

    //Snapshot to update remote description 
    onSnapshot(calldoc,(snapshot) => {
        const data = snapshot.data();
        if(!pc.currentRemoteDescription && data?.answer){
            pc.setRemoteDescription(new RTCSessionDescription(data.answer))
        }
    })

    //Snapshot for ice candidate changes in answer candidate document
    onSnapshot(collection(calldoc,"answerCandidates"),snapshot =>{
        snapshot.docChanges().forEach(docChange=>{
            if(docChange.type === "added"){
                pc.addIceCandidate(new RTCIceCandidate(docChange.doc.data()))
            }
        })
    })

    return calldoc.id;
}



let CreateAnswer = async (code)=>{
    const callId = code
    const calldoc = doc(calls,callId)

    pc.onicecandidate = event => {
        event.candidate && addDoc(collection(calldoc,"answerCandidates"),event.candidate.toJSON()).then(console.log("Done"))
    }


    const calldata = await getDoc(calldoc)

    if(calldata.exists()){
       const offerdesc = calldata.data().offerObject;
       console.log(offerdesc)
       await pc.setRemoteDescription(new RTCSessionDescription(offerdesc))
    }

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription)

    const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp
    }

    await updateDoc(calldoc,{answer})

  onSnapshot(collection(calldoc,"offerCandidates"),(snapshot) =>{
      snapshot.docChanges().forEach((change) =>{
          console.log(change);
          if(change.type === "added"){
              let data = change.doc.data();
              let newCandidate = new RTCIceCandidate(data)
              pc.addIceCandidate(newCandidate)
          }
      })
  })
}

let endCall = async () => {
    //Use id to delete doc
    
    pc.close();
 

    console.log(currCode)
    await deleteDoc(doc(calls,currCode));
    window.location = getURL();
   
} 

//Initialisation
var currCode = "";

let init = async () => {
    console.log(sp.has("answer"))
    if(sp.has("answer")){
        const docRef = doc(calls, sp.get("answer"));
        const docSnap = await getDoc(docRef);
 
        //Link Answer
        if (docSnap.exists()) {
            await StartWebcam()

                console.log("creating answer");
               await CreateAnswer(docSnap.id)
                GoToApp();
                currCode = docSnap.id;

                
           
        }else{
            
        }
    }else{
        //Lobby Screen show
    }
}


webcamButton.onclick = async () => {
    await StartWebcam();
    await GoToApp();
    let code = CreateOffer();

    code.then((data) => {
       navigator.clipboard.writeText(getURL() + "?"+"answer="+data )
       currCode = data;
    })
    
}



endButton.onclick = () => endCall();

pc.onconnectionstatechange = () =>{
    console.log(pc.connectionState)
    if(pc.connectionState == "disconnected"){
        endCall();
      
    }
}




window.onload = () =>init();

let joincall = async ()=>{

    //check if code exists
    
    const docRef = doc(calls,callCode.value);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
    window.location = getURL() + "?"+"answer="+ callCode.value; 
  
}else{
    $('#outputConsole').css('display', 'block').text( "Wrong code, please enter code correctly");
    console.log("Wrong code");
}
}

$("#joincall").on("click", () => joincall());



callInput.oninput= ()=>{
    console.log("change")
    if(callInput.value != ''){
        $("#joincall").removeClass("locked");
    }else{
        $("#joincall").addClass("locked");

    }
}
$("#inviteButton").on("click", () =>  navigator.clipboard.writeText( getURL()+ "?"+"answer="+ currCode ))
// Nav handling
var GoToApp = () =>{
    $(".lobbyScreen").css("display","none");
    $(".callingScreen").css("display","block");
}
var GoToLobby = () =>{
    $(".lobbyScreen").css("display","block");
    $(".callingScreen").css("display","none");
}


window.onbeforeunload = ()=>{
    if(currCode == ""){
        return;
    }

    deleteDoc(doc(calls,currCode)).then(()=>{
        console.log("Deleted")
    });
}


var getURL = function(){
    return window.location.protocol + '//' + window.location.host + window.location.pathname
}
//FIX answer being there when disconecting