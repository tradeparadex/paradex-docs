function render() { 
  function insertButton() {
    const targetDiv = document.querySelector('.bg-background-translucent.backdrop-blur-2xl');
    
    const authButton = targetDiv.querySelector('.danger');
    
    const walletConnectButton = targetDiv.querySelector('#wallet-connect-button');
    
    if (authButton && !walletConnectButton) {              
      const dropdown = targetDiv.querySelector('.fern-dropdown');
        if (dropdown) {
          const buttonArea = dropdown.querySelector('.justify-end');
          
          if (buttonArea) {
            const button = document.createElement('button');
            button.id = 'wallet-connect-button';
            button.className = 'fern-button';
            button.textContent = 'Wallet Connect';
            button.style.marginLeft = '10px';
            button.addEventListener('click', () => insertModal());
            buttonArea.appendChild(button);
          }
        }
      }
  }
  
  function closeModal(modal) {
    modal.style.display = 'none';
  }

  function insertModal() {
    let modal = document.getElementById('custom-modal');
    
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'custom-modal';
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      modal.style.display = 'flex';
      modal.style.justifyContent = 'center';
      modal.style.alignItems = 'center';

      const modalContent = document.createElement('div');
      modalContent.style.padding = '20px';
      modalContent.style.borderRadius = '5px';
      modalContent.style.textAlign = 'center';

      const message = document.createElement('p');
      message.textContent = 'Wallet Connect Authentication.';

      const closeButton = document.createElement('button');
      closeButton.textContent = 'Close';
      closeButton.style.marginTop = '10px';
      closeButton.addEventListener('click', () => closeModal(modal));

      modalContent.appendChild(message);
      modalContent.appendChild(closeButton);
      modal.appendChild(modalContent);
      document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
  }
  
  function isOnScreen(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  function checkAndInsertButton() {
    const playgroundEndpointDiv = document.querySelector('.playground-endpoint');
    
    if (playgroundEndpointDiv && isOnScreen(playgroundEndpointDiv)) {
      insertButton(); 
    }
  }

  document.addEventListener('click', function() {
    checkAndInsertButton();
  });

  checkAndInsertButton();
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", function() {
			render();
	});
} else {
	render();
}