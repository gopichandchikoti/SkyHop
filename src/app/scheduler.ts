interface Task {
  left: number;
  run: () => void;
}

/** Runs callbacks after a number of simulated seconds, so they pause when the game pauses. */
export class Scheduler {
  private tasks: Task[] = [];

  schedule(seconds: number, run: () => void): void {
    this.tasks.push({ left: seconds, run });
  }

  clear(): void {
    this.tasks = [];
  }

  advance(dt: number): void {
    const due: Task[] = [];
    this.tasks = this.tasks.filter((task) => {
      task.left -= dt;
      if (task.left > 0) return true;
      due.push(task);
      return false;
    });
    due.forEach((task) => task.run());
  }
}
