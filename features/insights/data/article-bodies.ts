// Long-form copy for each article, keyed by slug. Blocks render in order on
// the article page; the first paragraph is set as the lead.
export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] }

const p = (text: string): Block => ({ type: "p", text })
const h2 = (text: string): Block => ({ type: "h2", text })
const quote = (text: string): Block => ({ type: "quote", text })
const list = (...items: string[]): Block => ({ type: "list", items })

export const ARTICLE_BODIES: Record<string, Block[]> = {
  "why-pushing-harder-keeps-you-stuck": [
    p(
      "Most of the people who sit down in my clinic are not short on effort. They are capable, driven and used to solving problems by leaning in. So when something will not shift, whether it is a habit, a fear or a plateau at work, the instinct is to push harder. And the harder they push, the more stuck they feel."
    ),
    h2("Stuckness is rarely an effort problem"),
    p(
      "When we treat stuckness as a willpower deficit, we miss what is really going on. Underneath most persistent patterns is a part of the nervous system doing exactly what it was designed to do: keep you safe. If a change feels risky, even a change you consciously want, that system quietly applies the brakes."
    ),
    p(
      "Pushing harder against those brakes adds pressure, and pressure reads as threat. The system responds the only way it knows how, by holding on tighter. That is why effort alone so often produces the opposite of what we intend."
    ),
    quote(
      "You cannot bully a nervous system into feeling safe. You can only show it, again and again, that it is."
    ),
    h2("What the brakes are protecting"),
    p(
      "Every stuck pattern has a job. Procrastination may be protecting you from judgement. Overworking may be protecting you from feeling not enough. Anxiety before a presentation may be protecting you from an old memory of being caught out. When we get curious about the job, rather than fighting the pattern, it starts to loosen."
    ),
    h2("Three gentle ways to work with it"),
    list(
      "Lower the stakes. Shrink the next step until it feels almost too easy. Safety grows through small, repeated wins, not dramatic leaps.",
      "Name the protection. Ask, without judgement, what this pattern might be keeping you safe from. Write down whatever comes, even if it seems unrelated.",
      "Regulate before you act. Two minutes of slow breathing, with a longer out-breath than in-breath, signals safety to the body before you ask it to do something new."
    ),
    p(
      "None of this is about trying less. It is about directing effort where it actually helps: towards safety first, then change. In sessions, this is where hypnotherapy is so useful. It lets us speak to the part of you that holds the brakes, in a calm and focused state, rather than arguing with it from the outside."
    ),
    p(
      "If you recognise yourself here, you are not lazy and you are not broken. You are well protected. The work is to update that protection so it fits the life you are building now."
    ),
  ],

  "what-hypnosis-actually-feels-like": [
    p(
      "Before a first session, almost everyone asks me some version of the same question: what will it actually feel like? Stage shows and films have done a lot to shape our expectations, and very little of it matches what happens in a quiet clinic room."
    ),
    h2("Myth one: you will be unconscious"),
    p(
      "Hypnosis is not sleep. Most people describe it as a deeply relaxed, focused state, a little like the moment just before you drift off, or when you are absorbed in a good book and lose track of time. You can hear everything, and you remember most of it afterwards."
    ),
    h2("Myth two: you will lose control"),
    p(
      "You remain in charge throughout. You cannot be made to say or do anything that goes against your values, and you can open your eyes and end the session whenever you like. In fact, hypnosis works best when you are an active, willing participant."
    ),
    quote(
      "Most clients are surprised by how ordinary it feels. Calm, warm, a little heavy, and completely aware."
    ),
    h2("Myth three: some people cannot be hypnotised"),
    p(
      "If you can daydream, you can experience hypnosis. Some people go deeper than others, and that is fine. Depth is not what makes the work effective; focus and willingness are."
    ),
    h2("Myth four: it is a quick magic fix"),
    p(
      "Hypnotherapy can create change surprisingly quickly, but it is a collaborative process, not a spell. We set clear goals, practise between sessions and build on each step. The relaxed state simply makes it easier for new patterns to take hold."
    ),
    h2("Myth five: you have to believe in it"),
    p(
      "Scepticism is welcome. You do not need to believe anything in advance; you only need to be open enough to notice what happens. Many of my most successful clients arrived convinced it would not work for them."
    ),
    p(
      "If you are curious, the free discovery call is a good place to ask anything that is still on your mind. There is no commitment, and no question is too basic."
    ),
  ],

  "ten-minute-wind-down-routine": [
    p(
      "A racing mind at bedtime is rarely about the thoughts themselves. It is a sign that your nervous system is still in daytime mode, scanning for things to solve. The answer is not to force sleep but to give your body clear signals that the day is done."
    ),
    h2("Why routines work"),
    p(
      "The brain loves predictability. When the same small actions happen in the same order every evening, they become cues. Over a week or two, simply starting the routine begins to switch the body towards rest before you reach the pillow."
    ),
    h2("The ten-minute routine"),
    list(
      "Minutes 1 to 2: Close the day. Write down anything still on your mind and one thing that went well. Thoughts on paper are thoughts your brain no longer needs to rehearse.",
      "Minutes 3 to 5: Dim and slow. Lower the lights, put your phone out of reach and do some gentle stretches for your neck and shoulders.",
      "Minutes 6 to 8: Breathe long. In for four, out for six or seven. A longer out-breath is one of the quickest ways to calm the body.",
      "Minutes 9 to 10: Anchor. Picture a place where you have felt completely at ease and notice three details: a sound, a colour and a sensation."
    ),
    quote(
      "Sleep is not something you can do. It is something you allow, once the body feels safe enough."
    ),
    h2("When the mind still races"),
    p(
      "If thoughts return in bed, do not fight them. Label them kindly, 'planning' or 'worrying', and come back to the out-breath. If you are awake after twenty minutes, get up, keep the lights low and repeat the anchor somewhere else until you feel drowsy."
    ),
    p(
      "Give the routine at least two weeks before judging it. If sleep is still a struggle, a short course of hypnotherapy can help reset the patterns that keep your mind switched on at night."
    ),
  ],

  "insight-versus-change": [
    p(
      "Many clients arrive with a remarkable understanding of their own patterns. They can explain where their anxiety comes from, why they avoid conflict and what triggers the late-night spiral. And yet the pattern continues. Insight, it turns out, is only the first step."
    ),
    h2("Why knowing is not enough"),
    p(
      "Understanding lives in the thinking part of the brain. Habits and emotional reactions live much deeper, in systems that learn through experience and repetition rather than explanation. You can know exactly why you react a certain way and still react that way, because the part of you that reacts was never part of the conversation."
    ),
    quote(
      "Insight tells you where the door is. Practice is walking through it."
    ),
    h2("What turns insight into change"),
    list(
      "A new experience. The deeper systems update when they live through something different: staying calm in a moment that used to trigger you, even briefly.",
      "Repetition. One good moment is a beginning. Ten good moments start to become a new default.",
      "Safety. Change sticks when it happens in a state of calm. Under stress, we fall back to whatever is most familiar."
    ),
    h2("How sessions bridge the gap"),
    p(
      "This is why my work combines coaching and hypnotherapy. Coaching builds clarity and practical plans. Hypnotherapy gives us access to a calm, focused state where you can rehearse new responses until they feel natural. Between sessions, small real-world experiments reinforce what we practise."
    ),
    p(
      "If you already understand your pattern, that is genuinely valuable. It means we can move quickly to the part that changes it."
    ),
  ],

  "calm-is-a-skill": [
    p(
      "We tend to talk about calm people as if they were born that way. Some temperaments do lean steadier, but most of the composure you admire in others is learned. Calm is a skill, and like any skill it can be practised."
    ),
    h2("What calm actually is"),
    p(
      "Calm is not the absence of stress. It is the ability to notice stress rising and bring yourself back to a workable state before it takes over. The people who seem unflappable still feel pressure; they have simply trained a faster route back to steady."
    ),
    h2("The mechanics you can train"),
    list(
      "Noticing early. Most of us only register stress when it is loud. Learning to catch the first signs, a tight jaw or shallow breathing, gives you far more room to respond.",
      "A reliable reset. A short, rehearsed action, such as a long out-breath or pressing your feet into the floor, that you have practised enough to use under pressure.",
      "A kinder inner voice. Self-criticism adds a second layer of threat. A steady, matter-of-fact inner coach removes it."
    ),
    quote(
      "Composure is not something you have. It is something you return to, faster each time you practise."
    ),
    h2("Practise when it is easy"),
    p(
      "The mistake most people make is only trying to be calm in the hardest moments. Skills are built in low-stakes conditions first. Practise your reset in the queue at the shop or before opening your inbox, so it is ready when the real pressure arrives."
    ),
    p(
      "In sessions, we use hypnosis to rehearse those high-pressure moments in a safe, vivid way, so your body learns the new response before you need it."
    ),
  ],

  "decision-fatigue-always-on-leader": [
    p(
      "Senior leaders make hundreds of decisions a day, and the culture around them often celebrates being constantly available. But judgement is a finite resource. By late afternoon, many leaders are making their most important calls on their least reliable thinking."
    ),
    h2("How decision fatigue shows up"),
    list(
      "Defaulting to the safest or most familiar option.",
      "Putting off decisions that need a clear head.",
      "Irritability and shorter patience with the team.",
      "Second-guessing choices that would normally feel straightforward."
    ),
    h2("The myth of always-on"),
    p(
      "Being reachable at every moment can feel like commitment. In practice, it fragments attention and trains the whole team to escalate rather than decide. The leaders who protect their thinking tend to create more capable teams around them, not less."
    ),
    quote(
      "Your best thinking is a limited resource. Spend it on the decisions only you can make."
    ),
    h2("Protecting your best thinking"),
    list(
      "Batch small decisions into one or two set times rather than answering them as they arrive.",
      "Schedule important decisions for the hours when you are sharpest, usually earlier in the day.",
      "Delegate decisions with clear boundaries, so the team can act without checking in.",
      "Build short recovery breaks into the day. A few minutes of genuine rest restores more than another coffee."
    ),
    p(
      "For leadership teams, I run workshops that combine practical decision hygiene with techniques for staying calm and clear under pressure. The goal is simple: better decisions, made by people who are not running on empty."
    ),
  ],

  "self-hypnosis-beginners-guide": [
    p(
      "Self-hypnosis is one of the most useful skills I teach. It is simply a structured way of guiding yourself into a calm, focused state and using that state to rehearse something helpful. It takes about ten minutes and needs nothing but a quiet space."
    ),
    h2("Before you begin"),
    p(
      "Choose one simple goal for the session, phrased positively, such as 'I stay calm and clear in meetings'. Sit somewhere comfortable where you will not be disturbed, and set a gentle timer if you are worried about losing track of time."
    ),
    h2("The five steps"),
    list(
      "Settle. Close your eyes and take three slow breaths, letting each out-breath be a little longer than the last.",
      "Relax progressively. Move your attention from the top of your head down to your feet, softening each area as you go.",
      "Deepen. Imagine walking slowly down ten steps, counting each one and feeling a little more relaxed with every step.",
      "Rehearse. Picture your goal as if it is already happening. Notice what you see, hear and feel as the calm, capable version of you.",
      "Return. Count slowly from one to five, feeling more alert with each number, and open your eyes when you are ready."
    ),
    quote(
      "The more often you visit that calm state, the easier it becomes to find, and the more naturally it follows you into daily life."
    ),
    h2("Making it stick"),
    p(
      "Practise once a day for two weeks. Short and regular beats long and occasional. Keep the same goal for the whole fortnight so your mind has a clear, repeated message to work with."
    ),
    p(
      "Self-hypnosis is safe for most people, but it is not a substitute for medical or psychological care. If you live with a mental health condition, check with your GP first. If you would like guidance, I can record a personalised session for you to use at home."
    ),
  ],
}
