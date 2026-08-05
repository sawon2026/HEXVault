package main

import (
	"fmt"
	"log"
	"github.com/sawon2026/HEXVault/packages/sdk-go/hexvault"
)

func main() {
	c := hexvault.New("http://127.0.0.1:3850")
	h, err := c.Health()
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("health:", h)
}
