(function () {
  var ready = false;

  function detectEnv(token) {
    var fromConfig = (KPK.config.paddleEnv || '').toLowerCase();
    if (fromConfig === 'production' || fromConfig === 'live') return 'production';
    if (fromConfig === 'sandbox') return 'sandbox';
    if (token && String(token).indexOf('live_') === 0) return 'production';
    if (token && String(token).indexOf('test_') === 0) return 'sandbox';
    return 'production';
  }

  function boot() {
    if (!window.Paddle) {
      console.error('Paddle.js not loaded');
      return false;
    }
    var token = KPK.config.paddleToken;
    if (!token) {
      console.error('Missing Paddle client token');
      return false;
    }
    try {
      var env = detectEnv(token);
      Paddle.Environment.set(env);
      Paddle.Initialize({
        token: token,
        eventCallback: function (e) {
          if (e && e.name === 'checkout.error') {
            console.error('Paddle checkout error', e);
          }
        }
      });
      ready = true;
      console.log('Paddle ready', env);
      return true;
    } catch (err) {
      console.error('Paddle init failed', err);
      return false;
    }
  }

  function checkout(priceId, email, userId) {
    if (!ready && !boot()) {
      alert('Paddle is not configured. Check VITE_PADDLE_CLIENT_TOKEN on Vercel.');
      return;
    }
    priceId = String(priceId || '').trim();
    if (!priceId || priceId.indexOf('pri_') !== 0) {
      alert('Invalid price ID: ' + priceId + '\nSet VITE_PADDLE_PRICE_* to your Paddle price ids (pri_...).');
      return;
    }
    var opts = {
      items: [{ priceId: priceId, quantity: 1 }],
      customData: {
        email: String(email || ''),
        user_id: String(userId || ''),
        supabase_user_id: String(userId || '')
      }
    };
    if (email) {
      opts.customer = { email: String(email) };
    }
    try {
      Paddle.Checkout.open(opts);
    } catch (err) {
      console.error(err);
      alert('Checkout failed: ' + (err.message || err) + '\nCheck: live token + live prices, domain allowed in Paddle, price id matches env.');
    }
  }

  window.Billing = { boot: boot, checkout: checkout };
})();
