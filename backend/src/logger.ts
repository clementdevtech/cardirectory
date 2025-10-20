const logger = {
  info: (...args: any[]) => console.log("INFO:", ...args),
  error: (...args: any[]) => console.error("ERROR:", ...args),
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV !== "production") {
      console.log("DEBUG:", ...args);
    }
  }
};

export default logger;
