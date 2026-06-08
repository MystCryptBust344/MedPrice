/**
 * chat.js — Multi-thread chat frontend
 *
 * Architecture:
 *  - On load: fetch all threads. If none, auto-create a default one.
 *  - Active thread tracks `currentThreadId`.
 *  - Sidebar renders thread list. Clicking switches context.
 *  - Messages sent to /api/chat/threads/:threadId.
 *  - After first message, polls for auto-generated title and updates sidebar.
 *  - Rename (inline input on ✏️ click) and delete (🗑️ with soft confirm).
 *  - Mobile: sidebar toggled by ☰ button in header.
 */

$(document).ready(function () {

  // ── State ──────────────────────────────────────────────────────────────────
  let currentThreadId = null
  let threads = []         // Array of { threadId, title, updatedAt }
  let titlePollTimer = null

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const $sidebar        = $('#chat-sidebar')
  const $threadList     = $('#chat-thread-list')
  const $chatMessages   = $('#chat-history')
  const $chatForm       = $('#chat-form')
  const $chatInput      = $('#chat-input')
  const $chatHeaderSub  = $('#chat-header-sub')
  const $sidebarToggle  = $('#sidebar-toggle')
  const $newChatBtn     = $('#new-chat-btn')

  // ── Bootstrap: load threads on page open ──────────────────────────────────
  function bootstrap() {
    $.ajax({
      url: getApiUrl('/api/chat/threads'),
      method: 'GET',
      xhrFields: { withCredentials: true },
      success: function (res) {
        threads = res.threads || []
        if (threads.length === 0) {
          // Auto-create a default thread for a brand-new user.
          // createThread passes the new thread to our callback;
          // WE call renderSidebar + loadThread (not createThread itself).
          createThread(function (newThread) {
            renderSidebar()
            loadThread(newThread.threadId)
          })
        } else {
          renderSidebar()
          loadThread(threads[0].threadId)
        }
      },
      error: function () {
        // Fallback: use legacy endpoint for cached/old frontend bundles
        $.ajax({
          url: getApiUrl('/api/chat'),
          method: 'GET',
          xhrFields: { withCredentials: true },
          success: function (res) {
            if (res.threadId) {
              threads = [{ threadId: res.threadId, title: 'New Chat' }]
              currentThreadId = res.threadId
              renderSidebar()
              if (res.messages && res.messages.length > 0) {
                $chatMessages.empty()
                res.messages.forEach(m => appendMessage(m.role, m.content))
                scrollChatToBottom()
              } else {
                showEmptyState()
              }
            }
          }
        })
      }
    })
  }

  // ── Sidebar: render thread list ────────────────────────────────────────────
  function renderSidebar() {
    $threadList.empty()
    threads.forEach(function (t) {
      const isActive = t.threadId === currentThreadId
      const $item = $('<div>')
        .addClass('chat-thread-item' + (isActive ? ' active' : ''))
        .attr('data-id', t.threadId)

      const $icon  = $('<span class="thread-icon">💬</span>')
      const $title = $('<span class="thread-title">').text(t.title || 'New Chat')

      const $renameBtn = $('<button class="thread-action-btn" title="Rename">✏️</button>')
      const $deleteBtn = $('<button class="thread-action-btn delete-btn" title="Delete">🗑️</button>')
      const $actions   = $('<div class="thread-actions">').append($renameBtn, $deleteBtn)

      $item.append($icon, $title, $actions)
      $threadList.append($item)

      // Switch thread on click (not on action buttons)
      $item.on('click', function (e) {
        if ($(e.target).closest('.thread-actions').length) return
        closeSidebar()
        loadThread(t.threadId)
      })

      // Rename
      $renameBtn.on('click', function (e) {
        e.stopPropagation()
        startRename($item, $title, t)
      })

      // Delete
      $deleteBtn.on('click', function (e) {
        e.stopPropagation()
        deleteThread(t.threadId, $item)
      })
    })
  }

  // ── Load a thread's history into the message area ─────────────────────────
  // Uses a generation counter so a slow in-flight GET that resolves AFTER
  // the user has already sent a message doesn't wipe the live chat area.
  let loadGeneration = 0

  function loadThread(threadId) {
    currentThreadId = threadId
    const myGen = ++loadGeneration

    $chatMessages.empty()

    // Show loading placeholder
    $chatMessages.append(
      '<div class="chat-empty-state" id="thread-loading">' +
        '<div class="chat-empty-icon">⏳</div>' +
        '<div class="chat-empty-text">Loading conversation…</div>' +
      '</div>'
    )

    // Update active state in sidebar without full re-render (smoother UX)
    $('.chat-thread-item').removeClass('active')
    $(`.chat-thread-item[data-id="${threadId}"]`).addClass('active')

    // Update header subtitle with thread title
    const t = threads.find(x => x.threadId === threadId)
    if (t) $chatHeaderSub.text(t.title || 'New Chat')

    $.ajax({
      url: getApiUrl('/api/chat/threads/' + threadId),
      method: 'GET',
      xhrFields: { withCredentials: true },
      success: function (res) {
        // Stale response guard: if the user switched threads or sent a message
        // while this request was in-flight, bail out — don't overwrite the UI.
        if (myGen !== loadGeneration) return
        $chatMessages.empty()
        if (res.messages && res.messages.length > 0) {
          res.messages.forEach(m => appendMessage(m.role, m.content))
          scrollChatToBottom()
        } else {
          showEmptyState()
        }
      },
      error: function () {
        if (myGen !== loadGeneration) return
        $chatMessages.empty()
        showEmptyState()
      }
    })
  }

  function showEmptyState() {
    $chatMessages.append(
      '<div class="chat-empty-state">' +
        '<div class="chat-empty-icon">🩺</div>' +
        '<div class="chat-empty-text">Ask about any medical procedure,<br>hospital prices, or cost comparisons.</div>' +
      '</div>'
    )
  }

  // ── Create a new thread ────────────────────────────────────────────────────
  // NOTE: createThread does NOT call loadThread itself.
  // The caller (bootstrap or New Chat button) is responsible for navigation,
  // preventing the double-loadThread race condition.
  function createThread(onCreated) {
    $.ajax({
      url: getApiUrl('/api/chat/threads'),
      method: 'POST',
      contentType: 'application/json',
      xhrFields: { withCredentials: true },
      success: function (newThread) {
        threads.unshift(newThread)
        if (typeof onCreated === 'function') {
          onCreated(newThread)   // caller handles renderSidebar + loadThread
        } else {
          renderSidebar()
          loadThread(newThread.threadId)
        }
      },
      error: function () {
        console.warn('Failed to create new thread')
      }
    })
  }

  // ── Delete a thread ────────────────────────────────────────────────────────
  function deleteThread(threadId, $item) {
    // Soft confirm via a brief style change instead of blocking alert
    $item.css({ opacity: 0.5, pointerEvents: 'none' })

    $.ajax({
      url: getApiUrl('/api/chat/threads/' + threadId),
      method: 'DELETE',
      xhrFields: { withCredentials: true },
      success: function () {
        threads = threads.filter(t => t.threadId !== threadId)
        $item.slideUp(200, function () { $(this).remove() })

        if (currentThreadId === threadId) {
          // Switch to another thread, or create fresh one if none left
          if (threads.length > 0) {
            loadThread(threads[0].threadId)
          } else {
            createThread()
          }
        }
      },
      error: function () {
        $item.css({ opacity: 1, pointerEvents: '' })
        console.warn('Failed to delete thread')
      }
    })
  }

  // ── Inline rename ──────────────────────────────────────────────────────────
  function startRename($item, $titleSpan, thread) {
    const current = $titleSpan.text()
    const $input  = $('<input class="thread-rename-input">')
      .val(current)
      .on('click', e => e.stopPropagation())

    $titleSpan.replaceWith($input)
    $input.focus().select()

    function commitRename() {
      const newTitle = $input.val().trim() || current
      $input.replaceWith($('<span class="thread-title">').text(newTitle))
      if (newTitle === current) return

      $.ajax({
        url: getApiUrl('/api/chat/threads/' + thread.threadId),
        method: 'PATCH',
        contentType: 'application/json',
        xhrFields: { withCredentials: true },
        data: JSON.stringify({ title: newTitle }),
        success: function () {
          thread.title = newTitle
          // Update active header subtitle if this is the current thread
          if (thread.threadId === currentThreadId) {
            $chatHeaderSub.text(newTitle)
          }
        }
      })
    }

    $input.on('blur', commitRename)
    $input.on('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $input.blur() }
      if (e.key === 'Escape') { $input.val(current); $input.blur() }
    })
  }

  // ── Poll for auto-generated title after first message ─────────────────────
  // After the first message in a thread, the server fires-and-forgets an LLM
  // title generation. We poll once after 2.5s to pick up the result.
  function pollForTitle(threadId) {
    clearTimeout(titlePollTimer)
    titlePollTimer = setTimeout(function () {
      $.ajax({
        url: getApiUrl('/api/chat/threads/' + threadId),
        method: 'GET',
        xhrFields: { withCredentials: true },
        success: function (res) {
          if (res.title && res.title !== 'New Chat') {
            // Update our local cache
            const t = threads.find(x => x.threadId === threadId)
            if (t) t.title = res.title

            // Update sidebar item title (animated via titleFadeIn CSS keyframe)
            const $titleSpan = $(`.chat-thread-item[data-id="${threadId}"] .thread-title`)
            $titleSpan.fadeOut(150, function () {
              $(this).text(res.title).fadeIn(200)
            })

            // Update header subtitle
            if (threadId === currentThreadId) {
              $chatHeaderSub.text(res.title)
            }
          }
        }
      })
    }, 2500)
  }

  // ── New Chat button ────────────────────────────────────────────────────────
  $newChatBtn.on('click', function () {
    closeSidebar()
    createThread()
  })

  // ── Mobile sidebar toggle ──────────────────────────────────────────────────
  $sidebarToggle.on('click', function () {
    $sidebar.toggleClass('open')
  })

  // Close sidebar when clicking outside (mobile)
  $(document).on('click', function (e) {
    if ($sidebar.hasClass('open') &&
        !$(e.target).closest('#chat-sidebar').length &&
        !$(e.target).is($sidebarToggle)) {
      closeSidebar()
    }
  })

  function closeSidebar() {
    $sidebar.removeClass('open')
  }

  // ── Quick-start chips ──────────────────────────────────────────────────────
  $(document).on('click', '.chat-chip', function () {
    const text = $(this).text().replace(/^[^\s]+\s/, '') // strip emoji
    $chatInput.val(text).focus()
    $chatForm.trigger('submit')
  })

  // ── Send message ───────────────────────────────────────────────────────────
  $chatForm.on('submit', function (e) {
    e.preventDefault()
    const msg = $chatInput.val().trim()
    // Guard against sending before a thread is ready (edge case on slow connections)
    if (!msg) return
    if (!currentThreadId) {
      console.warn('No active thread yet — message dropped. Retrying after thread loads.')
      return
    }
    // Bump the generation counter so any pending loadThread GET won't wipe
    // the message the user just sent
    loadGeneration++

    const isFirstInThread = ($chatMessages.find('.chat-msg').length === 0) ||
                            ($chatMessages.find('.chat-empty-state').length > 0)

    // Clear empty state
    $chatMessages.find('.chat-empty-state').remove()

    appendMessage('user', msg)
    $chatInput.val('')
    scrollChatToBottom()

    const $typing = appendTypingIndicator()

    $.ajax({
      url: getApiUrl('/api/chat/threads/' + currentThreadId),
      method: 'POST',
      contentType: 'application/json',
      xhrFields: { withCredentials: true },
      data: JSON.stringify({ message: msg }),
      success: function (res) {
        $typing.remove()
        appendMessage('assistant', res.reply)
        if (res.procedures && res.procedures.length > 0) {
          appendProcedures(res.procedures)
        }
        scrollChatToBottom()

        // Touch updatedAt locally for sidebar ordering
        const t = threads.find(x => x.threadId === currentThreadId)
        if (t) t.updatedAt = new Date().toISOString()

        // If this was the first message, poll for auto-generated title
        if (isFirstInThread) {
          pollForTitle(currentThreadId)
        }
      },
      error: function (xhr) {
        $typing.remove()
        let errMsg = 'Sorry, something went wrong. Please try again.'
        if (xhr.responseJSON && xhr.responseJSON.error) errMsg = xhr.responseJSON.error
        appendMessage('assistant', '⚠️ ' + errMsg)
        scrollChatToBottom()
      }
    })
  })

  // ── Markdown helpers (unchanged) ──────────────────────────────────────────
  function parseMarkdown(text) {
    var lines = text.split('\n')
    var inTable = false
    var tableHtml = ''
    var resultLines = []

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim()
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) { inTable = true; tableHtml = '<div class="chat-table-container"><table class="chat-table">' }
        var cells = line.split('|').slice(1, -1).map(c => c.trim())
        var isSeparator = cells.every(c => /^[:\-]+$/.test(c))
        if (isSeparator) continue
        tableHtml += '<tr>'
        var isHeader = (tableHtml.match(/<tr>/g) || []).length === 1
        cells.forEach(c => { var tag = isHeader ? 'th' : 'td'; tableHtml += '<' + tag + '>' + parseInlineMarkdown(c) + '</' + tag + '>' })
        tableHtml += '</tr>'
      } else {
        if (inTable) { inTable = false; tableHtml += '</table></div>'; resultLines.push(tableHtml); tableHtml = '' }
        resultLines.push(line)
      }
    }
    if (inTable) { tableHtml += '</table></div>'; resultLines.push(tableHtml) }

    var body = resultLines.join('\n')
    body = body.replace(/^### (.*?)$/gm, '<h4>$1</h4>')
    body = body.replace(/^## (.*?)$/gm,  '<h3>$1</h3>')
    body = body.replace(/^# (.*?)$/gm,   '<h2>$1</h2>')

    var finalHtml = ''
    var inList = false
    body.split('\n').forEach(l => {
      if (l.trim().startsWith('- ') || l.trim().startsWith('* ')) {
        if (!inList) { inList = true; finalHtml += '<ul class="chat-list">' }
        finalHtml += '<li>' + parseInlineMarkdown(l.replace(/^[-*]\s+/, '')) + '</li>'
      } else {
        if (inList) { inList = false; finalHtml += '</ul>' }
        if (l.trim() !== '') {
          if (l.startsWith('<div') || l.startsWith('<h') || l.startsWith('<ul') || l.startsWith('<ol')) {
            finalHtml += l
          } else {
            finalHtml += '<p>' + parseInlineMarkdown(l) + '</p>'
          }
        }
      }
    })
    if (inList) finalHtml += '</ul>'
    return finalHtml
  }

  function parseInlineMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g,     '<em>$1</em>')
  }

  // ── appendMessage ─────────────────────────────────────────────────────────
  function appendMessage(role, text) {
    var bubbleClass  = role === 'user' ? 'chat-msg-user' : 'chat-msg-bot'
    var senderLabel  = role === 'user' ? 'You' : 'MedPrice AI'
    var parsedText   = role === 'user' ? text : parseMarkdown(text)

    var $bubble = $('<div class="chat-bubble">').html(parsedText)
    if (role !== 'user') {
      $bubble.css('animation', 'none')
      setTimeout(() => $bubble.css('animation', ''), 10)
    }

    var $msg = $('<div class="chat-msg ' + bubbleClass + '">')
      .append('<div class="msg-sender">' + senderLabel + '</div>')
      .append($bubble)

    $chatMessages.append($msg)
  }

  function appendTypingIndicator() {
    var $indicator = $(
      '<div class="chat-msg chat-msg-bot typing-indicator-msg">' +
        '<div class="msg-sender">MedPrice AI</div>' +
        '<div class="chat-bubble font-italic">Thinking…</div>' +
      '</div>'
    )
    $chatMessages.append($indicator)
    scrollChatToBottom()
    return $indicator
  }

  function appendProcedures(procs) {
    var prices = procs.map(p => p.cghsRate || 0).filter(Boolean)
    var minP   = prices.length ? Math.min(...prices) : 0
    var maxP   = prices.length ? Math.max(...prices) : 1
    var range  = maxP - minP || 1

    var chipsHtml = procs.map(p => {
      var dotPct = (((p.cghsRate || minP) - minP) / range * 100).toFixed(1)
      return [
        '<div style="display:flex;flex-direction:column;gap:4px;margin:4px 0">',
          '<a href="details?id=' + p.id + '" class="chat-proc-link">',
            '🔍 ' + p.commonName + ' <span class="chat-price-chip">₹' + (p.cghsRate || '—') + '</span>',
          '</a>',
          '<div class="chat-mini-corridor">',
            '<span class="chat-mini-corridor-label">CGHS rate position</span>',
            '<div class="chat-mini-track">',
              '<div class="chat-mini-fill" style="width:' + dotPct + '%"></div>',
              '<div class="chat-mini-dot"  style="left:' + dotPct + '%"></div>',
            '</div>',
          '</div>',
        '</div>'
      ].join('')
    }).join('')

    $chatMessages.append(
      $('<div class="chat-msg chat-msg-bot">')
        .append('<div class="msg-sender">MedPrice AI</div>')
        .append(
          $('<div class="chat-bubble">')
            .append('<p style="font-weight:600;margin-bottom:6px">Matched Procedures:</p>')
            .append('<div class="chat-proc-row">' + chipsHtml + '</div>')
        )
    )
  }

  function scrollChatToBottom() {
    var el = $chatMessages[0]
    if (el) el.scrollTop = el.scrollHeight
  }

  // ── Kick off ───────────────────────────────────────────────────────────────
  bootstrap()
})
