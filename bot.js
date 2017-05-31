// Modulos necesarios relacionados a Steam
const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');

var colors = require('colors');
var Prices = require('./Precios.json');
var config = require('./config');

// Creamos y nombramos una nueva instancia de dos Modulos
const community = new SteamCommunity();
const client = new SteamUser();

// Definimos un nuevo objeto con los siguientes datos-clave que usaremos para logear
const datosCuenta = {
	accountName: config.accountName,
	password: config.password,
  twoFactorCode: SteamTotp.generateAuthCode(config.shared_secret)
};

// Definimos otro objeto con los siguientes datos clave que sirven para analizar las ofertas de intercambio que lleguen
const manager = new TradeOfferManager({
	steam: client,
	community: community,
	language: 'en'
});

// Le ordenamos a nuestra instancia SteamUser que se conecte a Steam con los datos declarados.
client.logOn(datosCuenta);

// Iniciamos metodo que este pendiente del evento 'loggedOn' que aparece cuando logueamos correctamente.
client.on('loggedOn', () => {
	console.log('Se ha iniciado sesion en Steam'.green);
  // Iniciamos metodo que cambia el estado de la cuenta a "online y jugando a TF2"
  client.setPersona(SteamUser.Steam.EPersonaState.Online, config.botName);
	client.gamesPlayed(440);
  console.log(config.botname + 'Se encuentro Online y jugando a TF2');
});

// Iniciamos otro "event-listener" que este pendiente del evento 'webSession' que son las notificaciones que-
// recibiremos en la cuenta Steam. Ej: Invitaciones de amigos, ofertas de intercambio, etc.
client.on('webSession', (sessionid, cookies) => {
	manager.setCookies(cookies);
  community.setCookies(cookies);
  // En la siguiente linea de codigo, revisamos si debemos confirmar cualquier accion cada 10 segundos
	community.startConfirmationChecker(10000, config.identity_secret);
});

// Definimos otro "event-listener" que esta pendiente del evento 'newOffer' que ocurre cuando nos llega una nueva oferta
// de intercambio
manager.on('newOffer', (offer) => {
  console.log('--------------------------------------------------------------------------------');
  console.log(`Se ha recibido una nueva oferta de intercambio :#${offer.id} de ${offer.partner.getSteam3RenderedID()}`.green);
// Inciamos la siguiente funcion.
 processTradeOffer(offer);
});

// Funcion para analizar la oferta y aceptarla o no
function processTradeOffer(offer) {

  // Rechazamos la oferta si es invalida o si tiene los 15 dias de retencion por no tener activado Steam-Guard
  if(offer.isGlitched() || offer.state === 11) {
    console.log(`Se ha recibido una oferta de intercambio invalida #${offer.id}. Rechazando..`.red);
    declineTradeOffer(offer);
  }
  // Acepatmos la oferta si el User es una cuenta amiga. Sin importar los items
 else if (offer.partner.getSteamID64() === config.id_cuenta_amiga) {
		offer.accept((err, status) => {
			if (err) {
				console.log(err);
			} else {
				console.log(`Oferta Aceptada de una Cuenta Amiga. Estado : ${status}.`.green);
			}
		});
	}
  // No es amigo y no es invalida: analizamos los itemsADar y los itemsARecibir
  else {
    // Variables necesarias
    var itemsADar = offer.itemsToGive;
    var itemsARecibir = offer.itemsToReceive;
    var valorTotalADar = 0;
    var valorTotalARecibir = 0;
    // For para analizar cada item que vamos a dar
    for(var i in itemsADar) {
      var item = itemsADar[i].name;
      // Si los nombres de los items se encuentran en nuestra lista. Sumamos el valor detallado
      if(Precios[item]) {
        valorTotalADar += Precios[item].venta;
      }
      //Nos estan quitando items que no detallamos, agregamos un valor alto para que el bot rechaze la oferta.
      else {
        console.log('User nos esta quitando items que no se encuentran en la lista de precios. Rechazando..'.red)
        valorTotalADar += 99999999;
      }
    }
    // For para analizar cada item que vamos a recibir
       for(var i in itemsARecibir) {

				   var item = itemsADar[i].name;
         if(Precios[item]) {
           valorTotalARecibir += Precios[item].compra;
         }
         // User agrego item que no detallamos, simplemente avisamos en consola y no sumamos nada a valorTotalARecibir.
				 else{
					console.log('User agrego items que no se encuentran en nuestra lista de precios.'.orange)
				 }
       }

       console.log('El valor de los Items a dar es :'.bgRed + valorTotalADar);
       console.log('El valor de los Items a recibir es:'.bgGreen + valorTotalARecibir);

       // Si valorTotalADar es mayor o igual a valorTotalARecibir; Acepatmos..
       if(valorTotalADar <= valorTotalARecibir) {
         acceptTradeOffer(offer);
       }

       else {
         declineTradeOffer(offer);
       }
     }
   }
 function acceptTradeOffer(offer) {
		 //Aceptamos la oferta y analizamos la respuesta
	 
	   offer.accept(false, function(error, status) {
	
	     if(error) {
	       console.log(`\nError: No se pudo aceptar la oferta #${offer.id}\n`);
	       console.log(error);
	       return;
	     }
	 
	     else if(status === 'pending') {
	       console.log(`Estado : La oferta #${offer.id} ha sido aceptada pero necesita confirmarse`);
	 
	     community.acceptConfirmationForObject(config.identity_secret, offer.id, function(error) {
	 
	          if(error) {
	 
	           return;
	         }
	      
	         else {
	           console.log(`Estado : La oferta #${offer.id} ha sido confirmada`.green);
	           return;
	         }
	       });
	     }
	 
	     else {
	       console.log(`Estado : La oferta #${offer.id} ha sido aceptada`.green);
	       return;
	     }
	   });
	 }
	 function declineTradeOffer(offer) {
//Recahazamos la oferta y logeamos el error.
  offer.decline(function(error) {

    if(error) {
      console.log(`\nError: No se pudo rechazar la oferta, intentando de nuevo.. #${offer.id}\n`);
      console.log(error);
      return;
    }

    else {
      console.log(`Estado: La oferta #${offer.id} fue rechazada`);
      return;
    }
  });
}

