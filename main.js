import { Engine, Render, Runner, Bodies, World, Body, Sleeping, Events, Collision, Composite, Vector } from "matter-js";
import { FRUITS } from "./fruits";

const engine = Engine.create({
  constraintIterations: 10,
  positionIterations: 12,
  velocityIterations: 8
});
const world = engine.world;

const render = Render.create({
  engine: engine,
  element: document.body,
  options: {
    wireframes: false,
    background: "#F7F4C8",
    width: 620,
    height: 850,
  },
});

const leftwall = Bodies.rectangle(15, 395, 30, 790, {
  isStatic: true,
  render: { fillStyle: "#E6B143" }
});

const rightwall = Bodies.rectangle(605, 395, 30, 790, {
  isStatic: true,
  render: { fillStyle: "#E6B143" }
});

const ground = Bodies.rectangle(310, 820, 620, 60, {
  isStatic: true,
  render: { fillStyle: "#E6B143" }
});

const topline = Bodies.rectangle(310, 150, 620, 2, {
  name: "topLine",
  isStatic: true,
  isSensor: true,
  render: { fillStyle: "#E6B143" },
});

World.add(world, [leftwall, rightwall, ground, topline]);

Render.run(render);

// create runner
var runner = Runner.create();
Runner.run(runner, engine);

let currentBody = null;
let currentFruit = null;
let interval = null;
let disableAction = null;

function addFruit() {
  const index = Math.floor(Math.random() * 5);
  const fruit = FRUITS[index];

  const body = Bodies.circle(300, 50, fruit.radius, {
    index: index,
    isSleeping: true,
    render: {
      sprite: { texture: `${fruit.name}.png` }
    },
    restitution: 0.2,
    label: "fruit",
    collisionFilter: {
      group: Body.nextGroup(true)
    },
    plugin: {
      isScheduledForCombination: false
    }
  });
  currentBody = body;
  currentFruit = fruit;

  World.add(world, body);
}

window.onkeydown = (event) => {
  if (disableAction) return;

  switch (event.code) {
    case "ArrowLeft": 
      if (interval) return;
      interval = setInterval(() => {
        if (currentBody.position.x - currentFruit.radius > 30) {
          Body.setPosition(currentBody, {
            x: currentBody.position.x - 5,
            y: currentBody.position.y,
          });
        }
      }, 5);
      break;
    case "ArrowRight":
      if (interval) return;
      interval = setInterval(() => {
        if (currentBody.position.x + currentFruit.radius < 590) {
          Body.setPosition(currentBody, {
            x: currentBody.position.x + 5,
            y: currentBody.position.y,
          });
        }
      }, 5);
      break; 
    case "Space":
      currentBody.isSleeping = false;
      disableAction = true;
      setTimeout(() => {
        addFruit();  
        disableAction = false;
      }, 1000);
      break;
  }
};

window.onkeyup = (event) => {
  switch (event.code) {
    case "ArrowLeft":
    case "ArrowRight":
      clearInterval(interval);
      interval = null;
  }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function combineFruits(bodyA, bodyB, collision) {
  const index = bodyA.index;

  // 마지막 과일이면 아무 것도 하지 않음
  if (index === FRUITS.length - 1) return;

  // 충돌 지점 계산
  const support = collision.collision.supports[0];
  const newPosition = { x: support.x, y: support.y };

  // 새 과일의 반지름
  const newFruit = FRUITS[index + 1];
  const newRadius = newFruit.radius;

  // 게임 영역의 경계 설정
  const minX = 30 + newRadius;
  const maxX = 590 - newRadius;
  const minY = 150 + newRadius;
  const maxY = 790 - newRadius;

  // 새 위치를 게임 영역 내로 제한
  newPosition.x = clamp(newPosition.x, minX, maxX);
  newPosition.y = clamp(newPosition.y, minY, maxY);

  // 기존 과일들을 즉시 제거
  World.remove(world, bodyA);
  World.remove(world, bodyB);

  console.log(`Removed fruits at positions (${bodyA.position.x.toFixed(2)}, ${bodyA.position.y.toFixed(2)}) and (${bodyB.position.x.toFixed(2)}, ${bodyB.position.y.toFixed(2)})`);

  // 새 과일 생성
  const newBody = Bodies.circle(
    newPosition.x,
    newPosition.y,
    newRadius,
    {
      index: index + 1,
      render: {
        sprite: {
          texture: `${newFruit.name}.png`,
        },
      },
      label: "fruit",
      collisionFilter: {
        group: Body.nextGroup(true)
      }
    }
  );

  // 새 과일 추가
  World.add(world, newBody);

  console.log(`New fruit created: ${newFruit.name} at position (${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(2)})`);
  console.log(`New fruit position: ${newPosition.x} , ${newPosition.y}`);
}

Events.on(engine, "collisionStart", (event) => {
  event.pairs.forEach((collision) => {
    const { bodyA, bodyB } = collision;
    
    if (bodyA.label === "fruit" && bodyB.label === "fruit") {
      console.log(`Collision detected between fruits: ${FRUITS[bodyA.index].name} and ${FRUITS[bodyB.index].name}`);
      if (bodyA.index === bodyB.index) {
        combineFruits(bodyA, bodyB, collision);
      }
    }
    
    // 게임 오버 조건 체크
    if (
      (bodyA.name === "topLine" || bodyB.name === "topLine") && 
      (bodyA.label === "fruit" || bodyB.label === "fruit") &&
      !disableAction
    ) {
      alert("Game Over");
    }
  });
});

// 매 프레임마다 실행되는 업데이트 함수
Events.on(engine, "afterUpdate", () => {
  const bodies = Composite.allBodies(world);
  bodies.forEach((body) => {
    if (body.label === "fruit" && body.plugin.isScheduledForCombination) {
      World.remove(world, body);
      console.log(`Removed fruit: ${FRUITS[body.index].name}`);
    }
  });
});

addFruit();
